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

test("edit MCP tool relays one exact routine snapshot and explains ambiguity and retries", async () => {
  const inputs: EditRoutineRequest[] = [];
  await withTool(
    async (userId, input) => {
      expect(userId).toBe("authenticated-user");
      inputs.push(input);

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

      const input = { operationId, expected, changes: { productName: "Magnesium glycinate" } };
      const result = await client.callTool({ name: "edit_intake_routine", arguments: input });
      expect(result.isError).toBe(false);
      expect(resultJson(result)).toEqual({
        status: "updated",
        operationId,
        routineId: expected.id,
        reminder: "none",
      });
      expect(inputs).toEqual([input]);
    },
  );
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

      for (const status of ["unconfirmed", "conflict"]) {
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

      expect(calls).toBe(2);
    },
  );
});
