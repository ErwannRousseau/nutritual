import { websocket } from "@hono/bun";
import { app } from "./app.ts";

export { app };

export const serverConfig = {
  hostname: "0.0.0.0",
  port: Number(Bun.env.PORT ?? 3000),
  fetch: app.fetch,
  websocket,
};

export default serverConfig;
