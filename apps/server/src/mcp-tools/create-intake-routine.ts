import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CreateRoutineStatus, validateRoutineInput } from "@nutritual/protocol";
import { z } from "zod";
import type { RoutineRelay } from "../routine-relay.ts";

export function isRoutineToolError(status: string): boolean {
  return status !== CreateRoutineStatus.created && status !== CreateRoutineStatus.alreadyProcessed;
}

const frequencySchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("weekdays"),
      days: z
        .array(z.number().int())
        .describe("Days numbered 0 for Sunday through 6 for Saturday."),
    }),
    z.object({
      kind: z.literal("interval"),
      every: z.number().int(),
      startDate: z.string().describe("Start date in YYYY-MM-DD format."),
    }),
    z.object({ kind: z.literal("as-needed") }),
  ])
  .describe("Repeat on weekdays, every N days from a start date, or as needed.");

const routineInputSchema = z
  .object({
    productName: z.string().trim().min(1).max(120),
    frequency: frequencySchema,
    time: z
      .string()
      .describe("Local phone time in 24-hour HH:mm format; use an empty string as needed."),
    operationId: z
      .uuid()
      .describe(
        "Generate a UUID before each intentional creation. On an ambiguous or unconfirmed result, retry with the exact same operationId and original input without asking the user for an identifier. Use a new UUID for every new intention, even an identical routine.",
      ),
  })
  .superRefine(({ productName, frequency, time }, context) => {
    const error = validateRoutineInput({ productName, frequency, time });

    if (error) context.addIssue({ code: "custom", message: error });
  });

export function registerCreateIntakeRoutineTool(
  server: McpServer,
  relay: RoutineRelay,
  userId: string,
): void {
  server.registerTool(
    "create_intake_routine",
    {
      description:
        "Create an intake routine on the paired Nutritual phone. Provide a UUID operationId generated before the call. If delivery is unconfirmed or the response is ambiguous, retry with the exact same operationId and original input without asking the user for an identifier. Use a new UUID for a new intentional creation, even when its details match an earlier routine. Times are local phone time. Weekdays use 0 for Sunday through 6 for Saturday. A created status means the routine was saved, not that a reminder was delivered or the supplement was taken. reminder is scheduled, denied (permission unavailable), failed (scheduling failed), unconfirmed (scheduling not confirmed), or none (no reminder requested).",
      inputSchema: routineInputSchema,
    },
    async ({ productName, frequency, time, operationId }) => {
      const outcome = await relay.createRoutine(userId, {
        productName,
        operationId,
        frequency,
        time,
      });

      const result = { ...outcome, operationId };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: isRoutineToolError(result.status),
      };
    },
  );
}
