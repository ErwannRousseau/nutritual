import { Hono } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";
import { registerDeviceRoutes } from "./routes/device.ts";
import { registerHealthRoutes } from "./routes/health.ts";
import { registerMcpRoutes } from "./routes/mcp.ts";
import { registerOAuthPages } from "./routes/oauth-pages.ts";
import { registerPairingRoutes } from "./routes/pairing.ts";
import { registerPhoneRoutes } from "./routes/phone.ts";
import { createRoutineRelay } from "./routine-relay.ts";
import { createPairingOperations } from "./pairing-operations.ts";
import { createPairingStore } from "./pairing-store.ts";

export const app = new Hono<McpAuthVariables>();
const relay = createRoutineRelay();
const pairingOperations = createPairingOperations(createPairingStore(), relay);

registerHealthRoutes(app);

registerDeviceRoutes(app, relay, pairingOperations);

registerPairingRoutes(app, pairingOperations);

registerOAuthPages(app);

registerPhoneRoutes(app, pairingOperations);

registerMcpRoutes(app, relay, pairingOperations);
