import { ListRoutinesStatus } from "@nutritual/protocol";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RoutineRelay } from "../routine-relay.ts";
import { prompt } from "./prompt.ts";

export function registerListIntakeRoutinesTool(
  server: McpServer,
  relay: RoutineRelay,
  userId: string,
): void {
  server.registerTool(
    "list_intake_routines",
    {
      description: prompt(
        "List all current intake routines on the paired phone, including paused and as-needed",
        "routines. Each routine has a stable id and its current fields for identifying it and",
        "detecting later changes. Times are local phone time and do not apply to as-needed",
        "routines. Weekdays use 0 for Sunday through 6 for Saturday.",
      ),
      inputSchema: {},
    },
    async () => {
      const result = await relay.listRoutines(userId);

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: result.status !== ListRoutinesStatus.ok,
      };
    },
  );
}
