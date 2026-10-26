import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CreateRoutineStatus } from "@nutritual/protocol";
import { z } from "zod";
import type { RoutineRelay } from "../routine-relay.ts";

export function isRoutineToolError(status: string): boolean {
  return status !== CreateRoutineStatus.created && status !== CreateRoutineStatus.alreadyProcessed;
}

export function registerCreateIntakeRoutineTool(
  server: McpServer,
  relay: RoutineRelay,
  userId: string,
): void {
  server.tool(
    "create_intake_routine",
    "Create an as-needed intake routine on the paired Nutritual phone. If delivery is unconfirmed, retry with the same operationId.",
    {
      productName: z.string().trim().min(1).max(120),
      operationId: z.string().uuid(),
    },
    async ({ productName, operationId }) => {
      const outcome = await relay.createRoutine(userId, {
        productName,
        operationId,
        frequency: { kind: "as-needed" },
        time: "",
      });

      return {
        content: [{ type: "text", text: JSON.stringify(outcome) }],
        isError: isRoutineToolError(outcome.status),
      };
    },
  );
}
