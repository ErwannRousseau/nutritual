import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DeleteRoutineStatus, isDeleteRoutineRequest } from "@nutritual/protocol";
import { z } from "zod";
import type { RoutineRelay } from "../routine-relay.ts";

const frequencySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("weekdays"), days: z.array(z.number().int()) }),
  z.object({ kind: z.literal("interval"), every: z.number().int(), startDate: z.string() }),
  z.object({ kind: z.literal("as-needed") }),
]);

const deleteRoutineSchema = z
  .object({
    operationId: z.uuid(),
    expected: z.object({
      id: z.string().min(1),
      productName: z.string(),
      frequency: frequencySchema,
      time: z.string(),
      paused: z.boolean(),
    }),
  })
  .superRefine((value, context) => {
    if (!isDeleteRoutineRequest(value))
      context.addIssue({ code: "custom", message: "Provide the exact listed routine." });
  });

export function registerDeleteIntakeRoutineTool(
  server: McpServer,
  relay: RoutineRelay,
  userId: string,
): void {
  server.registerTool(
    "delete_intake_routine",
    {
      description:
        "Delete one intake routine from the paired Nutritual phone when the user asks to delete it. First call list_intake_routines and pass the exact listed routine as expected. Do not ask for an extra confirmation after the user has requested deletion. If multiple routines could match, ask which one before deleting. For several routines, make one tool call per routine with a distinct UUID operationId and exact listed snapshot. If delivery is unconfirmed or the response is ambiguous, retry the exact same operationId and full input to discover whether it was processed. A conflict means the routine changed since listing: list again and ask the user to clarify before deleting. deleted or already_processed confirms removal; reminder reports cleanup status and does not confirm notification delivery or intake history changes.",
      inputSchema: deleteRoutineSchema,
    },
    async (input) => {
      const outcome = await relay.deleteRoutine(userId, input);
      const result = { ...outcome, operationId: input.operationId };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError:
          result.status !== DeleteRoutineStatus.deleted &&
          result.status !== DeleteRoutineStatus.alreadyProcessed,
      };
    },
  );
}
