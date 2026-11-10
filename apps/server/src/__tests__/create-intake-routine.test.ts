import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CreateRoutineDeliveryResult, CreateRoutineRequest } from "@nutritual/protocol";
import { createRoutineRelay, type RoutineRelay } from "../routine-relay.ts";
import { registerCreateIntakeRoutineTool } from "../mcp-tools/create-intake-routine.ts";

const operationId = "c6d611b7-b4a7-427a-bce1-50c3a2815d88";

async function withTool(
  createRoutine: RoutineRelay["createRoutine"],
  run: (client: Client) => Promise<void>,
): Promise<void> {
  const server = new McpServer({ name: "test", version: "1.0.0" });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const relay = createRoutineRelay();
  relay.createRoutine = createRoutine;

  registerCreateIntakeRoutineTool(server, relay, "authenticated-user");
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  try {
    await run(client);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
}

const toolResultSchema = z.object({
  status: z.string(),
  operationId: z.string(),
  reminder: z.string().optional(),
});

function resultText(result: Awaited<ReturnType<Client["callTool"]>>) {
  const text = result.content.find((item) => item.type === "text");

  if (text?.type !== "text") throw new Error("MCP tool did not return text content.");

  return toolResultSchema.parse(JSON.parse(text.text));
}

test("MCP tool relays every frequency through the real MCP client interface", async () => {
  const inputs: CreateRoutineRequest[] = [];
  await withTool(
    async (userId, input) => {
      expect(userId).toBe("authenticated-user");

      inputs.push(input);

      return {
        status: "created",
        operationId: input.operationId,
        routineId: "routine-1",
        reminder: "scheduled",
      };
    },
    async (client) => {
      const tool = (await client.listTools()).tools.find(
        (item) => item.name === "create_intake_routine",
      );

      expect(tool?.description).toContain("without asking the user for an identifier");
      expect(tool?.description).toContain("0 for Sunday through 6 for Saturday");
      expect(tool?.description).toContain("not that a reminder was delivered");

      const calls = [
        {
          productName: "Magnesium",
          frequency: { kind: "weekdays", days: [0, 2, 6] },
          time: "08:30",
          operationId,
        },
        {
          productName: "Vitamin D",
          frequency: { kind: "interval", every: 3, startDate: "2026-11-04" },
          time: "09:15",
          operationId,
        },
        {
          productName: "Electrolytes",
          frequency: { kind: "as-needed" },
          time: "",
          operationId,
        },
      ];

      for (const input of calls) {
        const result = await client.callTool({ name: "create_intake_routine", arguments: input });
        expect(result.isError).toBeFalsy();
        expect(resultText(result).operationId).toBe(operationId);
      }

      expect(inputs).toEqual(calls);
    },
  );
});

test("MCP validates routine fields with the shared protocol rules before relaying", async () => {
  let calls = 0;
  await withTool(
    async () => {
      calls += 1;

      return { status: "created", operationId, routineId: "routine-1", reminder: "scheduled" };
    },
    async (client) => {
      for (const input of [
        { productName: " ", frequency: { kind: "as-needed" }, time: "", operationId },
        {
          productName: "Magnesium",
          frequency: { kind: "weekdays", days: [] },
          time: "08:30",
          operationId,
        },
        {
          productName: "Magnesium",
          frequency: { kind: "weekdays", days: [0, 0] },
          time: "08:30",
          operationId,
        },
        {
          productName: "Magnesium",
          frequency: { kind: "weekdays", days: [7] },
          time: "08:30",
          operationId,
        },
        {
          productName: "Magnesium",
          frequency: { kind: "interval", every: 0, startDate: "2026-11-04" },
          time: "08:30",
          operationId,
        },
        {
          productName: "Magnesium",
          frequency: { kind: "interval", every: 2, startDate: "2026-02-30" },
          time: "08:30",
          operationId,
        },
        {
          productName: "Magnesium",
          frequency: { kind: "weekdays", days: [1] },
          time: "25:00",
          operationId,
        },
      ]) {
        const result = await client.callTool({ name: "create_intake_routine", arguments: input });
        expect(result.isError).toBe(true);
      }

      expect(calls).toBe(0);
    },
  );
});

test("MCP preserves relay statuses and always includes the retry operationId", async () => {
  const outcomes: CreateRoutineDeliveryResult[] = [
    { status: "unavailable", message: "Phone unavailable." },
    { status: "unconfirmed", operationId, message: "No acknowledgment." },
    { status: "conflict", operationId, message: "Operation conflict." },
    { status: "already_processed", operationId, routineId: "routine-1", reminder: "none" },
  ];

  await withTool(
    async () => outcomes.shift()!,
    async (client) => {
      for (const expectedStatus of [
        "unavailable",
        "unconfirmed",
        "conflict",
        "already_processed",
      ]) {
        const result = await client.callTool({
          name: "create_intake_routine",
          arguments: {
            productName: "Magnesium",
            frequency: { kind: "as-needed" },
            time: "",
            operationId,
          },
        });

        const payload = resultText(result);
        expect(payload.status).toBe(expectedStatus);
        expect(payload.operationId).toBe(operationId);
        expect(result.isError).toBe(expectedStatus !== "already_processed");
      }
    },
  );
});

test("MCP preserves every reminder outcome without treating it as an intake", async () => {
  const reminders = ["scheduled", "denied", "failed", "unconfirmed", "none"] as const;
  let nextReminder = 0;

  await withTool(
    async () => ({
      status: "created",
      operationId,
      routineId: "routine-1",
      reminder: reminders[nextReminder++]!,
    }),
    async (client) => {
      for (const reminder of reminders) {
        const result = await client.callTool({
          name: "create_intake_routine",
          arguments: {
            productName: "Magnesium",
            frequency: { kind: "as-needed" },
            time: "",
            operationId,
          },
        });

        expect(result.isError).toBe(false);
        expect(resultText(result)).toEqual({ status: "created", operationId, reminder });
      }
    },
  );
});

test("MCP lists the current routines or reports an unavailable phone", async () => {
  const { registerListIntakeRoutinesTool } = await import("../mcp-tools/list-intake-routines.ts");
  const server = new McpServer({ name: "test", version: "1.0.0" });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const relay = createRoutineRelay();
  registerListIntakeRoutinesTool(server, relay, "authenticated-user");
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  try {
    const result = await client.callTool({ name: "list_intake_routines", arguments: {} });
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify({ status: "unavailable", message: "No phone is connected." }),
      },
    ]);

    const routines = [
      {
        id: "a",
        productName: "Magnesium",
        frequency: { kind: "as-needed" },
        time: "",
        paused: true,
      },
      {
        id: "b",
        productName: "Magnesium",
        frequency: { kind: "weekdays", days: [1] },
        time: "08:30",
        paused: false,
      },
    ];

    await relay.connectPhone(
      "authenticated-user",
      {
        id: "socket",
        deviceId: "phone",
        pairingId: "pairing",
        close: () => undefined,
        send: (raw) => {
          const message = JSON.parse(raw);
          relay.receiveListResult("other-user", "socket", {
            type: "list_routines_result",
            requestId: message.requestId,
            result: { status: "ok", routines: [] },
          });
          relay.receiveListResult("authenticated-user", "socket", {
            type: "list_routines_result",
            requestId: message.requestId,
            result: { status: "ok", routines },
          });
        },
      },
      async () => true,
    );
    const listed = await client.callTool({ name: "list_intake_routines", arguments: {} });
    expect(listed.isError).toBe(false);
    expect(listed.content).toEqual([
      { type: "text", text: JSON.stringify({ status: "ok", routines }) },
    ]);
    relay.disconnectPairedPhone("authenticated-user", "phone", "pairing");
    const disconnected = await client.callTool({ name: "list_intake_routines", arguments: {} });
    expect(disconnected.isError).toBe(true);
    expect(disconnected.content).toEqual(result.content);
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
});
