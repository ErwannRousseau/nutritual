import { Hono } from "hono";
import { registerDeviceRoutes } from "./routes/device.ts";
import { registerHealthRoutes } from "./routes/health.ts";
import { registerIntakeRoutineRoutes } from "./routes/intake-routines.ts";
import { createRoutineRelay } from "./routine-relay.ts";

export const app = new Hono();
const relay = createRoutineRelay();

registerHealthRoutes(app);

registerDeviceRoutes(app, relay);

registerIntakeRoutineRoutes(app, relay);
