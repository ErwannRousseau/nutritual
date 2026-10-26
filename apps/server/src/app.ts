import { Hono } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";
import { registerDeviceRoutes } from "./routes/device.ts";
import { registerHealthRoutes } from "./routes/health.ts";
import { registerMcpRoutes } from "./routes/mcp.ts";
import { registerOAuthPages } from "./routes/oauth-pages.ts";
import { registerPairingRoutes } from "./routes/pairing.ts";
import { registerPhoneRoutes } from "./routes/phone.ts";
import { createRoutineRelay } from "./routine-relay.ts";

export const app = new Hono<McpAuthVariables>();
const relay = createRoutineRelay();

registerHealthRoutes(app);

registerDeviceRoutes(app, relay);

registerPairingRoutes(app);

registerOAuthPages(app);

registerPhoneRoutes(app, relay);

registerMcpRoutes(app, relay);
