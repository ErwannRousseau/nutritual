import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { honoMcp, type McpAuthVariables } from "@neon/oauth/mcp/hono";
import { z } from "zod";
import { Hono } from "hono";
import { CreateRoutineStatus } from "@nutritual/protocol";
import type { RoutineRelay } from "../routine-relay.ts";
import { mcpAuth } from "../neon-auth.ts";
import { config } from "../neon-auth.ts";
import type { PairingOperations } from "../pairing-operations.ts";

export function isRoutineToolError(status: string): boolean {
  return status !== CreateRoutineStatus.created && status !== CreateRoutineStatus.alreadyProcessed;
}

export function registerMcpRoutes(
  app: Hono<McpAuthVariables>,
  relay: RoutineRelay,
  operations: PairingOperations,
): void {
  app.use(honoMcp(mcpAuth, { path: "/mcp" }));
  app.all("/mcp", async (c) => {
    const userId = c.get("auth").sub;

    if (!(await operations.canUseMcpClient(userId, c.get("auth").clientId, config.mobileClientId)))
      return c.json({ error: "forbidden" }, 403);
    const server = new McpServer({ name: "nutritual", version: "1.0.0" });
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

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);

    return transport.handleRequest(c.req.raw, { authInfo: c.get("authInfo") });
  });
}
