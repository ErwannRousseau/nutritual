import type { Hono } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";

export function registerHealthRoutes(app: Hono<McpAuthVariables>) {
  app.get("/", (c) => c.text("Hello Hono!"));
  app.get("/health", (c) => c.json({ status: "ok" }));
}
