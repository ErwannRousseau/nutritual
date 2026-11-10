import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  isDeleteRoutineCommandMessage,
  type DeleteRoutineCommandMessage,
  type DeleteRoutineRequest,
} from "@nutritual/protocol";
import { createRoutineRelay } from "../routine-relay.ts";
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
