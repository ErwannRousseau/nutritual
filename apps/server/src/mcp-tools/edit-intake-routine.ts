import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EditRoutineStatus, isEditRoutineRequest } from "@nutritual/protocol";
import { z } from "zod";
import type { RoutineRelay } from "../routine-relay.ts";

const frequencySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("weekdays"), days: z.array(z.number().int()) }),
  z.object({ kind: z.literal("interval"), every: z.number().int(), startDate: z.string() }),
  z.object({ kind: z.literal("as-needed") }),
]);

const routineSchema = z.object({
  id: z.string().min(1),
  productName: z.string(),
  frequency: frequencySchema,
  time: z.string(),
  paused: z.boolean(),
});

const editRoutineSchema = z
  .object({
    operationId: z.uuid(),
    expected: routineSchema,
    changes: z.object({
      productName: z.string().trim().min(1).optional(),
      frequency: frequencySchema.optional(),
      time: z.string().optional(),
    }),
  })
  .superRefine((value, context) => {
    if (!isEditRoutineRequest(value))
      context.addIssue({ code: "custom", message: "Provide valid routine changes." });
  });

export function registerEditIntakeRoutineTool(
  server: McpServer,
  relay: RoutineRelay,
  userId: string,
): void {
  server.registerTool(
    "edit_intake_routine",
    {
      description:
        "Edit one intake routine on the paired Nutritual phone. First use list_intake_routines and pass the exact listed routine as expected, then specify only the fields to change. If multiple routines could match the user's request, ask which one before editing. For a request affecting several routines, make one tool call per routine, each with its own UUID operationId and exact expected snapshot. On an unconfirmed or ambiguous result, retry the exact same operationId and full input: the phone returns the prior outcome when already processed, so the retry discovers whether the edit took effect without applying it twice. A conflict means the routine changed since it was listed; list again and clarify if the target is no longer unambiguous. An updated or already_processed status confirms the routine change was saved. The reminder field reports scheduling status only and does not confirm notification delivery or an intake. Times are local phone time; weekdays use 0 for Sunday through 6 for Saturday.",
      inputSchema: editRoutineSchema,
    },
    async (input) => {
      const outcome = await relay.editRoutine(userId, input);
      const result = { ...outcome, operationId: input.operationId };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError:
          result.status !== EditRoutineStatus.updated &&
          result.status !== EditRoutineStatus.alreadyProcessed,
      };
    },
  );
}
