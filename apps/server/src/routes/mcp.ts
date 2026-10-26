import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { honoMcp, type McpAuthVariables } from "@neon/oauth/mcp/hono";
import { Hono } from "hono";
import type { RoutineRelay } from "../routine-relay.ts";
import { registerCreateIntakeRoutineTool } from "../mcp-tools/create-intake-routine.ts";
import { mcpAuth } from "../neon-auth.ts";
import { config } from "../neon-auth.ts";
import type { PairingOperations } from "../pairing-operations.ts";

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
    registerCreateIntakeRoutineTool(server, relay, userId);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);

    return transport.handleRequest(c.req.raw, { authInfo: c.get("authInfo") });
  });
}
