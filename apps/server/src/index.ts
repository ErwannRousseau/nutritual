import { websocket } from "@hono/bun";
import { app } from "./app.ts";
import { PORT } from "./env.ts";

export { app };

export const serverConfig = {
  hostname: "0.0.0.0",
  port: PORT,
  fetch: app.fetch,
  websocket,
};

export default serverConfig;
