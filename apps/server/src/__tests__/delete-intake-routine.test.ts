import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  isDeleteRoutineCommandMessage,
  type DeleteRoutineCommandMessage,
  type DeleteRoutineRequest,
} from "@nutritual/protocol";
import { createRoutineRelay, type RoutineRelay } from "../routine-relay.ts";
import { registerDeleteIntakeRoutineTool } from "../mcp-tools/delete-intake-routine.ts";

const input: DeleteRoutineRequest = {
  operationId: "7a98fdf5-bc7a-4641-b7b7-f932f9ed8901",
  expected: {
    id: "routine-1",
    productName: "Magnesium",
    frequency: { kind: "as-needed" },
    time: "",
    paused: false,
  },
};

function resultJson(result: Awaited<ReturnType<Client["callTool"]>>) {
  const item = result.content.find((content) => content.type === "text");

  if (item?.type !== "text") throw new Error("MCP tool did not return text content.");

  return JSON.parse(item.text);
}

async function withDeleteTool(
  deleteRoutine: RoutineRelay["deleteRoutine"],
  run: (client: Client) => Promise<void>,
) {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const relay = createRoutineRelay();
  relay.deleteRoutine = deleteRoutine;
  registerDeleteIntakeRoutineTool(server, relay, "authenticated-user");
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  try {
    await run(client);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
}

test("MCP deletion validates the listed snapshot and returns the phone outcome", async () => {
  const relay = createRoutineRelay();
  let command: DeleteRoutineCommandMessage | undefined;
  await relay.connectPhone(
    "authenticated-user",
    {
      id: "socket",
      deviceId: "phone",
      pairingId: "pairing",
      close: () => undefined,
      send: (raw) => {
        const message: unknown = JSON.parse(raw);

        if (!isDeleteRoutineCommandMessage(message)) throw new Error("Invalid delete command.");
        command = message;
        relay.receiveDeleteResult("authenticated-user", "socket", {
          type: "delete_routine_result",
          requestId: message.requestId,
          result: {
            status: "deleted",
            operationId: message.command.operationId,
            routineId: message.command.expected.id,
            reminder: "none",
          },
        });
      },
    },
    async () => true,
  );

  const server = new McpServer({ name: "test", version: "1.0.0" });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  registerDeleteIntakeRoutineTool(server, relay, "authenticated-user");
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  try {
    const tool = (await client.listTools()).tools.find(
      (item) => item.name === "delete_intake_routine",
    );

    expect(tool?.description).toContain("list_intake_routines");
    expect(tool?.description).toContain("retry the exact same operationId and full input");

    const result = await client.callTool({ name: "delete_intake_routine", arguments: input });
    expect(result.isError).toBe(false);
    expect(resultJson(result)).toEqual({
      status: "deleted",
      operationId: input.operationId,
      routineId: input.expected.id,
      reminder: "none",
    });
    expect(command?.command).toEqual(input);

    const invalid = await client.callTool({
      name: "delete_intake_routine",
      arguments: { ...input, expected: { ...input.expected, productName: "" } },
    });

    expect(invalid.isError).toBe(true);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});

test("delete relay reports unavailable and unconfirmed outcomes", async () => {
  const relay = createRoutineRelay();
  expect(await relay.deleteRoutine("authenticated-user", input)).toEqual({
    status: "unavailable",
    message: "No phone is connected.",
  });

  await relay.connectPhone(
    "authenticated-user",
    {
      id: "socket",
      deviceId: "phone",
      pairingId: "pairing",
      close: () => undefined,
      send: () => undefined,
    },
    async () => true,
  );
  const delivery = relay.deleteRoutine("authenticated-user", input);
  relay.disconnectPhone("authenticated-user", "socket");
  expect(await delivery).toMatchObject({ status: "unconfirmed", operationId: input.operationId });
});

test("MCP deletes multiple routines in separate calls with independent outcomes", async () => {
  const calls: DeleteRoutineRequest[] = [];

  await withDeleteTool(
    async (_userId, request) => {
      calls.push(request);

      if (request.expected.id === "routine-2")
        return {
          status: "conflict",
          operationId: request.operationId,
          message: "Routine changed.",
        };

      return {
        status: "deleted",
        operationId: request.operationId,
        routineId: request.expected.id,
        reminder: "none",
      };
    },
    async (client) => {
      const tool = (await client.listTools()).tools.find(
        (item) => item.name === "delete_intake_routine",
      );

      expect(tool?.description).toContain("one tool call per routine");

      const first = input;

      const second: DeleteRoutineRequest = {
        operationId: "ad230ba3-c3a0-4eb6-b67a-e794e08385e2",
        expected: { ...input.expected, id: "routine-2", productName: "Vitamin D" },
      };

      const firstResult = await client.callTool({
        name: "delete_intake_routine",
        arguments: first,
      });

      const secondResult = await client.callTool({
        name: "delete_intake_routine",
        arguments: second,
      });

      expect(firstResult.isError).toBe(false);
      expect(resultJson(firstResult)).toEqual({
        status: "deleted",
        operationId: first.operationId,
        routineId: first.expected.id,
        reminder: "none",
      });
      expect(secondResult.isError).toBe(true);
      expect(resultJson(secondResult)).toEqual({
        status: "conflict",
        operationId: second.operationId,
        message: "Routine changed.",
      });
      expect(calls).toEqual([first, second]);
    },
  );
});

test("retrying deletion after a lost acknowledgment reuses its exact command", async () => {
  const relay = createRoutineRelay();
  let firstCommand: DeleteRoutineCommandMessage | undefined;
  let sendCount = 0;

  const connectPhone = async (id: string) =>
    relay.connectPhone(
      "authenticated-user",
      {
        id,
        deviceId: "phone",
        pairingId: "pairing",
        close: () => undefined,
        send: (raw) => {
          const value: unknown = JSON.parse(raw);

          if (!isDeleteRoutineCommandMessage(value)) throw new Error("Invalid delete command.");
          sendCount += 1;

          if (sendCount === 1) {
            firstCommand = value;

            return;
          }

          if (!firstCommand) throw new Error("First delete command was not sent.");
          expect(value.command).toEqual(firstCommand.command);
          relay.receiveDeleteResult("authenticated-user", id, {
            type: "delete_routine_result",
            requestId: value.requestId,
            result: {
              status: "already_processed",
              operationId: input.operationId,
              routineId: input.expected.id,
              reminder: "none",
            },
          });
        },
      },
      async () => true,
    );

  await connectPhone("first-socket");
  const firstAttempt = relay.deleteRoutine("authenticated-user", input);

  if (!firstCommand) throw new Error("First delete command was not sent.");

  relay.disconnectPhone("authenticated-user", "first-socket");
  expect(await firstAttempt).toMatchObject({
    status: "unconfirmed",
    operationId: input.operationId,
  });

  await connectPhone("second-socket");
  expect(await relay.deleteRoutine("authenticated-user", input)).toEqual({
    status: "already_processed",
    operationId: input.operationId,
    routineId: input.expected.id,
    reminder: "none",
  });
  expect(sendCount).toBe(2);
});

test("delete relay rejects acknowledgments for another operation or routine", async () => {
  const relay = createRoutineRelay();
  let command: DeleteRoutineCommandMessage | undefined;
  await relay.connectPhone(
    "authenticated-user",
    {
      id: "socket",
      deviceId: "phone",
      pairingId: "pairing",
      close: () => undefined,
      send: (raw) => {
        const value: unknown = JSON.parse(raw);

        if (!isDeleteRoutineCommandMessage(value)) throw new Error("Invalid delete command.");
        command = value;
      },
    },
    async () => true,
  );

  const delivery = relay.deleteRoutine("authenticated-user", input);

  if (!command) throw new Error("Delete command was not sent.");

  const ack = {
    type: "delete_routine_result" as const,
    requestId: command.requestId,
    result: {
      status: "deleted" as const,
      operationId: input.operationId,
      routineId: input.expected.id,
      reminder: "none" as const,
    },
  };

  relay.receiveDeleteResult("authenticated-user", "socket", {
    ...ack,
    result: { ...ack.result, operationId: "different-operation" },
  });
  relay.receiveDeleteResult("authenticated-user", "socket", {
    ...ack,
    result: { ...ack.result, routineId: "different-routine" },
  });
  relay.receiveDeleteResult("authenticated-user", "socket", ack);

  expect(await delivery).toEqual({
    status: "deleted",
    operationId: input.operationId,
    routineId: input.expected.id,
    reminder: "none",
  });
});
