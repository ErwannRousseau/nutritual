import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  isEditRoutineResult,
  isEditRoutineCommandMessage,
  type EditRoutineCommandMessage,
  type EditRoutineDeliveryResult,
  type EditRoutineRequest,
} from "@nutritual/protocol";
import { createRoutineRelay, type RoutineRelay } from "../routine-relay.ts";
import { registerEditIntakeRoutineTool } from "../mcp-tools/edit-intake-routine.ts";

const operationId = "7a98fdf5-bc7a-4641-b7b7-f932f9ed8901";

const expected: EditRoutineRequest["expected"] = {
  id: "routine-1",
  productName: "Magnesium",
  frequency: { kind: "as-needed" },
  time: "",
  paused: false,
};

function resultJson(result: Awaited<ReturnType<Client["callTool"]>>) {
  const item = result.content.find((content) => content.type === "text");

  if (item?.type !== "text") throw new Error("MCP tool did not return text content.");

  return JSON.parse(item.text);
}

async function withTool(
  editRoutine: RoutineRelay["editRoutine"],
  run: (client: Client) => Promise<void>,
) {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const relay = createRoutineRelay();
  relay.editRoutine = editRoutine;
  registerEditIntakeRoutineTool(server, relay, "authenticated-user");
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  try {
    await run(client);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
}

test("MCP edits multiple routines in separate calls with independent outcomes", async () => {
  const inputs: EditRoutineRequest[] = [];
  const longProductName = "A".repeat(121);
  await withTool(
    async (userId, input) => {
      expect(userId).toBe("authenticated-user");
      inputs.push(input);

      if (input.expected.id === "routine-2")
        return { status: "conflict", operationId: input.operationId, message: "Routine changed." };

      return {
        status: "updated",
        operationId: input.operationId,
        routineId: input.expected.id,
        reminder: "none",
      };
    },
    async (client) => {
      const tool = (await client.listTools()).tools.find(
        (item) => item.name === "edit_intake_routine",
      );

      expect(tool?.description).toContain("ask which one");
      expect(tool?.description).toContain("retry the exact same operationId and full input");
      expect(tool?.description).toContain("one tool call per routine");
      expect(tool?.description).toContain("routine change was saved");
      expect(tool?.description).toContain("does not confirm notification delivery or an intake");

      const firstInput = { operationId, expected, changes: { productName: longProductName } };
      const first = await client.callTool({ name: "edit_intake_routine", arguments: firstInput });
      expect(first.isError).toBe(false);
      expect(resultJson(first)).toEqual({
        status: "updated",
        operationId,
        routineId: expected.id,
        reminder: "none",
      });

      const secondInput = {
        operationId: "ad230ba3-c3a0-4eb6-b67a-e794e08385e2",
        expected: { ...expected, id: "routine-2", productName: "Vitamin D" },
        changes: { productName: "Vitamin D3" },
      };

      const second = await client.callTool({ name: "edit_intake_routine", arguments: secondInput });
      expect(second.isError).toBe(true);
      expect(resultJson(second)).toEqual({
        status: "conflict",
        operationId: secondInput.operationId,
        message: "Routine changed.",
      });
      expect(inputs).toEqual([firstInput, secondInput]);
    },
  );
});

test("edit relay reports unavailable before delivery and unconfirmed after a lost acknowledgment", async () => {
  const relay = createRoutineRelay();

  const input: EditRoutineRequest = {
    operationId,
    expected,
    changes: { productName: "Magnesium glycinate" },
  };

  expect(await relay.editRoutine("authenticated-user", input)).toEqual({
    status: "unavailable",
    message: "No phone is connected.",
  });

  await relay.connectPhone(
    "authenticated-user",
    {
      id: "first-socket",
      deviceId: "phone",
      pairingId: "pairing",
      close: () => undefined,
      send: () => undefined,
    },
    async () => true,
  );

  const firstAttempt = relay.editRoutine("authenticated-user", input);
  relay.disconnectPhone("authenticated-user", "first-socket");
  expect(await firstAttempt).toMatchObject({ status: "unconfirmed", operationId });
});

test("retrying an edit after a lost acknowledgment reuses its exact command and returns prior outcome", async () => {
  const relay = createRoutineRelay();

  const input: EditRoutineRequest = {
    operationId,
    expected,
    changes: { productName: "Magnesium glycinate" },
  };

  let firstCommand: EditRoutineCommandMessage | undefined;
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

          if (!isEditRoutineCommandMessage(value)) throw new Error("Invalid edit command.");
          sendCount += 1;

          if (sendCount === 1) {
            firstCommand = value;

            return;
          }

          if (!firstCommand) throw new Error("First edit command was not sent.");
          expect(value.command).toEqual(firstCommand.command);
          relay.receiveEditResult("authenticated-user", id, {
            type: "edit_routine_result",
            requestId: value.requestId,
            result: {
              status: "already_processed",
              operationId,
              routineId: expected.id,
              reminder: "none",
            },
          });
        },
      },
      async () => true,
    );

  await connectPhone("first-socket");
  const firstAttempt = relay.editRoutine("authenticated-user", input);

  if (!firstCommand) throw new Error("First edit command was not sent.");

  relay.disconnectPhone("authenticated-user", "first-socket");
  expect(await firstAttempt).toMatchObject({ status: "unconfirmed", operationId });

  await connectPhone("second-socket");
  expect(await relay.editRoutine("authenticated-user", input)).toEqual({
    status: "already_processed",
    operationId,
    routineId: expected.id,
    reminder: "none",
  });
  expect(sendCount).toBe(2);
});

test("edit relay ignores success acknowledgments for another routine and rejects empty success IDs", async () => {
  const relay = createRoutineRelay();
  let command: EditRoutineCommandMessage | undefined;
  await relay.connectPhone(
    "authenticated-user",
    {
      id: "socket",
      deviceId: "phone",
      pairingId: "pairing",
      close: () => undefined,
      send: (raw) => {
        const value: unknown = JSON.parse(raw);

        if (!isEditRoutineCommandMessage(value)) throw new Error("Invalid edit command.");
        command = value;
      },
    },
    async () => true,
  );

  const input: EditRoutineRequest = {
    operationId,
    expected,
    changes: { productName: "Magnesium glycinate" },
  };

  const delivery = relay.editRoutine("authenticated-user", input);

  if (!command) throw new Error("Edit command was not sent.");

  const message = {
    type: "edit_routine_result" as const,
    requestId: command.requestId,
    result: {
      status: "updated" as const,
      operationId,
      routineId: "another-routine",
      reminder: "none" as const,
    },
  };

  relay.receiveEditResult("authenticated-user", "socket", message);
  relay.receiveEditResult("authenticated-user", "socket", {
    ...message,
    result: { ...message.result, routineId: expected.id },
  });

  expect(await delivery).toMatchObject({
    status: "updated",
    operationId,
    routineId: expected.id,
  });
  expect(isEditRoutineResult({ ...message.result, routineId: "" })).toBe(false);
});

test("edit MCP tool validates snapshots and preserves unconfirmed/conflict outcomes", async () => {
  const outcomes: EditRoutineDeliveryResult[] = [
    { status: "unavailable", message: "Phone is offline." },
    { status: "unconfirmed", operationId, message: "No acknowledgment." },
    { status: "conflict", operationId, message: "Routine changed." },
  ];

  let calls = 0;
  await withTool(
    async () => {
      calls += 1;

      return outcomes.shift()!;
    },
    async (client) => {
      const invalid = await client.callTool({
        name: "edit_intake_routine",
        arguments: { operationId, expected, changes: {} },
      });

      expect(invalid.isError).toBe(true);
      expect(calls).toBe(0);

      for (const status of ["unavailable", "unconfirmed", "conflict"]) {
        const result = await client.callTool({
          name: "edit_intake_routine",
          arguments: { operationId, expected, changes: { productName: "New name" } },
        });

        expect(result.isError).toBe(true);
        expect(resultJson(result)).toMatchObject({
          status,
          operationId,
        });
      }

      expect(calls).toBe(3);
    },
  );
});

test("MCP pauses and resumes routines and treats unchanged as a successful no-op", async () => {
  const inputs: EditRoutineRequest[] = [];
  await withTool(
    async (_userId, input) => {
      inputs.push(input);

      if (input.expected.paused === input.changes.paused) {
        return {
          status: "unchanged",
          operationId: input.operationId,
          routineId: input.expected.id,
          reminder: "unconfirmed",
        };
      }

      return {
        status: "updated",
        operationId: input.operationId,
        routineId: input.expected.id,
        reminder: "none",
      };
    },
    async (client) => {
      const tool = (await client.listTools()).tools.find(
        (item) => item.name === "edit_intake_routine",
      );

      expect(tool?.description).toContain("Pause or resume");
      expect(tool?.description).toContain("unchanged");
      expect(
        isEditRoutineResult({
          status: "unchanged",
          operationId,
          routineId: expected.id,
          reminder: "unconfirmed",
        }),
      ).toBe(true);

      for (const [index, paused] of [true, false].entries()) {
        const input = {
          operationId: index === 0 ? operationId : "ad230ba3-c3a0-4eb6-b67a-e794e08385e2",
          expected: { ...expected, paused: !paused },
          changes: { paused },
        };

        const result = await client.callTool({ name: "edit_intake_routine", arguments: input });
        expect(result.isError).toBe(false);
        expect(resultJson(result)).toEqual({
          status: "updated",
          operationId: input.operationId,
          routineId: expected.id,
          reminder: "none",
        });
      }

      const alreadyPaused = {
        operationId: "455aa7c9-c62b-442d-8974-4ac1de0e8992",
        expected: { ...expected, paused: true },
        changes: { paused: true },
      };

      const noOp = await client.callTool({ name: "edit_intake_routine", arguments: alreadyPaused });
      expect(noOp.isError).toBe(false);
      expect(resultJson(noOp)).toEqual({
        status: "unchanged",
        operationId: alreadyPaused.operationId,
        routineId: expected.id,
        reminder: "unconfirmed",
      });

      const invalid = await client.callTool({
        name: "edit_intake_routine",
        arguments: { operationId, expected, changes: { paused: "yes" } },
      });

      expect(invalid.isError).toBe(true);
      expect(inputs).toEqual([
        {
          operationId,
          expected: { ...expected, paused: false },
          changes: { paused: true },
        },
        {
          operationId: "ad230ba3-c3a0-4eb6-b67a-e794e08385e2",
          expected: { ...expected, paused: true },
          changes: { paused: false },
        },
        alreadyPaused,
      ]);
    },
  );
});

test("MCP preserves listed details and relays explicit clearing", async () => {
  const calls: EditRoutineRequest[] = [];
  await withTool(
    async (_userId, input) => {
      calls.push(input);

      return {
        status: "updated",
        operationId: input.operationId,
        routineId: input.expected.id,
        reminder: "none",
      };
    },
    async (client) => {
      const snapshot = { ...expected, form: "powder", quantity: { amount: 2, unit: "scoops" } };
      const input = { operationId, expected: snapshot, changes: { form: null, quantity: null } };

      expect(
        (await client.callTool({ name: "edit_intake_routine", arguments: input })).isError,
      ).toBe(false);
      expect(calls).toEqual([input]);

      for (const changes of [
        { form: " " },
        { quantity: { amount: 1 } },
        { quantity: { amount: -1, unit: "g" } },
        { quantity: { amount: 0.0000001, unit: "g" } },
      ]) {
        expect(
          (
            await client.callTool({
              name: "edit_intake_routine",
              arguments: { operationId, expected: snapshot, changes },
            })
          ).isError,
        ).toBe(true);
      }

      expect(calls).toHaveLength(1);
    },
  );
});
