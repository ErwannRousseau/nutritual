import type { Hono } from "hono";

export function registerHealthRoutes(app: Hono): void {
  app.get("/", (c) => c.text("Hello Hono!"));
  app.get("/health", (c) => c.json({ status: "ok" }));
}
