import { expect, test } from "bun:test";
import { websocket } from "@hono/bun";
import { Hono } from "hono";
import { Pool } from "pg";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";
import {
  isCreateRoutineCommandMessage,
  type CreateRoutineRequest,
  type CreateRoutineResultMessage,
} from "@nutritual/protocol";
import { createRoutineRelay } from "./routine-relay.ts";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";

process.env.NEON_AUTH_BASE_URL ??= "https://auth.test.invalid";

process.env.PUBLIC_BASE_URL ??= "https://api.test.invalid";

process.env.MOBILE_OAUTH_CLIENT_ID ??= "https://mobile.test.invalid/client.json";

const { registerDeviceRoutes } = await import("./routes/device.ts");
const { digest } = await import("./pairing-store.ts");

const testTicket = "single-use-device-ticket";
let ticketConsumed = false;

const fakeDatabase = Object.assign(new Pool({ connectionString: process.env.DATABASE_URL }), {
  async query(sql: string, values: unknown[] = []) {
    if (sql.includes("UPDATE app_device_tickets")) {
      if (ticketConsumed || values[0] !== digest(testTicket)) return { rows: [], rowCount: 0 };
      ticketConsumed = true;

      return {
        rows: [{ user_sub: "user-1", device_id: "device-1", pairing_id: "pairing-1" }],
        rowCount: 1,
      };
    }

    if (sql.includes("SELECT 1 FROM app_paired_devices")) {
      return values[0] === "user-1" && values[1] === "device-1" && values[2] === "pairing-1"
        ? { rows: [{ 1: 1 }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }

    throw new Error(`Unexpected test SQL: ${sql}`);
  },
});

function runningDeviceServer() {
  const app = new Hono<McpAuthVariables>();
  const relay = createRoutineRelay();
  registerDeviceRoutes(app, relay, {
    database: fakeDatabase,
    digest,
    ready: async () => undefined,
  });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch, websocket });

  return { app, relay, server };
}

test("device route rejects missing and replayed tickets and relays the real phone result", async () => {
  ticketConsumed = false;
  const { relay, server } = runningDeviceServer();

  try {
    const missing = await fetch(new URL("/device", server.url));
    expect(missing.status).toBe(401);

    const url = new URL("/device", server.url);
    url.protocol = "ws:";
    url.searchParams.set("ticket", testTicket);
    const phone = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      phone.addEventListener("open", () => resolve(), { once: true });
      phone.addEventListener("error", () => reject(new Error("WebSocket connection failed.")), {
        once: true,
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 10));

    const request: CreateRoutineRequest = {
      operationId: "c6d611b7-b4a7-427a-bce1-50c3a2815d88",
      productName: "Magnesium",
      frequency: { kind: "as-needed" },
      time: "",
    };

    const commandPromise = new Promise<CreateRoutineResultMessage>((resolve, reject) => {
      phone.addEventListener(
        "message",
        (event) => {
          const value: unknown = JSON.parse(String(event.data));

          if (!isCreateRoutineCommandMessage(value))
            return reject(new Error("Invalid command message."));
          resolve({
            type: "create_routine_result",
            requestId: value.requestId,
            result: {
              status: "created",
              operationId: request.operationId,
              routineId: "routine-1",
              reminder: "none",
            },
          });
        },
        { once: true },
      );
    });

    const delivery = relay.createRoutine("user-1", request);
    phone.send(JSON.stringify(await commandPromise));
    const result = await delivery;
    expect(result.status).toBe("created");

    const replay = await fetch(
      new URL(`/device?ticket=${encodeURIComponent(testTicket)}`, server.url),
    );

    expect(replay.status).toBe(401);
    phone.close();
  } finally {
    server.stop(true);
  }
});
