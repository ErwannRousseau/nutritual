import type { Hono } from "hono";
import { auth } from "../auth.ts";

export function registerAuthRoutes(app: Hono): void {
  app.all("/api/auth/*", (c) => auth.handler(c.req.raw));
}
