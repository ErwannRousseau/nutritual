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
const { createPairingStore, digest } = await import("./pairing-store.ts");
const { createPairingOperations } = await import("./pairing-operations.ts");

const testTicket = "single-use-device-ticket";

const tickets = new Map([
  [testTicket, "pairing-1"],
  ["second-device-ticket", "pairing-1"],
  ["new-pairing-ticket", "pairing-2"],
]);

const consumedTickets = new Set<string>();
let pairingCheck: () => Promise<boolean> = async () => true;

const fakeDatabase = Object.assign(new Pool({ connectionString: process.env.DATABASE_URL }), {
  async query(sql: string, values: unknown[] = []) {
    if (sql.includes("UPDATE app_device_tickets")) {
      const ticket = [...tickets.keys()].find((value) => digest(value) === values[0]);

      if (!ticket || consumedTickets.has(ticket)) return { rows: [], rowCount: 0 };
      consumedTickets.add(ticket);

      return {
        rows: [{ user_sub: "user-1", device_id: "device-1", pairing_id: tickets.get(ticket) }],
        rowCount: 1,
      };
    }

    if (sql.includes("SELECT 1 FROM app_paired_devices")) {
      const paired = await pairingCheck();

      return values[0] === "user-1" && values[1] === "device-1" && values[2] === "pairing-1"
        ? paired
          ? { rows: [{ 1: 1 }], rowCount: 1 }
          : { rows: [], rowCount: 0 }
        : { rows: [], rowCount: 0 };
    }

    throw new Error(`Unexpected test SQL: ${sql}`);
  },
});

function runningDeviceServer() {
  const app = new Hono<McpAuthVariables>();
  const relay = createRoutineRelay();

  const store = createPairingStore({
    database: fakeDatabase,
    digest,
    ready: async () => undefined,
  });

  registerDeviceRoutes(app, relay, createPairingOperations(store, relay));
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch, websocket });

  return { app, relay, server };
}

test("device route rejects missing and replayed tickets and relays the real phone result", async () => {
  consumedTickets.clear();
  pairingCheck = async () => true;
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));

  return { promise, resolve };
}

function socketFor(server: ReturnType<typeof Bun.serve>, ticket: string) {
  const url = new URL("/device", server.url);
  url.protocol = "ws:";
  url.searchParams.set("ticket", ticket);

  return new WebSocket(url);
}

function acknowledgeNextCommand(phone: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    phone.addEventListener(
      "message",
      (event) => {
        const value: unknown = JSON.parse(String(event.data));

        if (!isCreateRoutineCommandMessage(value)) {
          reject(new Error("Invalid command message."));

          return;
        }

        const result: CreateRoutineResultMessage = {
          type: "create_routine_result",
          requestId: value.requestId,
          result: {
            status: "created",
            operationId: value.command.operationId,
            routineId: "routine-1",
            reminder: "none",
          },
        };

        phone.send(JSON.stringify(result));
        resolve();
      },
      { once: true },
    );
  });
}

test("a pending pairing check cannot receive commands or replace the active phone", async () => {
  consumedTickets.clear();
  pairingCheck = async () => true;
  const { relay, server } = runningDeviceServer();
  const activePhone = socketFor(server, testTicket);

  try {
    await new Promise<void>((resolve, reject) => {
      activePhone.addEventListener("open", () => resolve(), { once: true });
      activePhone.addEventListener("error", () => reject(new Error("WebSocket failed.")), {
        once: true,
      });
    });

    const initialDelivery = relay.createRoutine("user-1", {
      operationId: "f490c9b0-b05f-49ee-ae09-89eb1bd48cc6",
      productName: "Magnesium",
      frequency: { kind: "as-needed" },
      time: "",
    });

    await acknowledgeNextCommand(activePhone);
    expect((await initialDelivery).status).toBe("created");

    const checkStarted = deferred<void>();
    const allowCheck = deferred<boolean>();
    pairingCheck = async () => {
      checkStarted.resolve();

      return allowCheck.promise;
    };

    const pendingPhone = socketFor(server, "second-device-ticket");
    await new Promise<void>((resolve, reject) => {
      pendingPhone.addEventListener("open", () => resolve(), { once: true });
      pendingPhone.addEventListener("error", () => reject(new Error("WebSocket failed.")), {
        once: true,
      });
    });
    await checkStarted.promise;

    const activeDelivery = relay.createRoutine("user-1", {
      operationId: "f490c9b0-b05f-49ee-ae09-89eb1bd48cc6",
      productName: "Magnesium",
      frequency: { kind: "as-needed" },
      time: "",
    });

    await acknowledgeNextCommand(activePhone);
    expect((await activeDelivery).status).toBe("created");

    allowCheck.resolve(true);
    await new Promise<void>((resolve) =>
      activePhone.addEventListener("close", () => resolve(), { once: true }),
    );

    const delivery = relay.createRoutine("user-1", {
      operationId: "c6d611b7-b4a7-427a-bce1-50c3a2815d88",
      productName: "Magnesium",
      frequency: { kind: "as-needed" },
      time: "",
    });

    await acknowledgeNextCommand(pendingPhone);
    expect((await delivery).status).toBe("created");
    activePhone.close();
    pendingPhone.close();
  } finally {
    server.stop(true);
  }
});

test("a closed pending socket cannot activate after its pairing check succeeds", async () => {
  consumedTickets.clear();
  const checkStarted = deferred<void>();
  const allowCheck = deferred<boolean>();
  pairingCheck = async () => {
    checkStarted.resolve();

    return allowCheck.promise;
  };

  const { relay, server } = runningDeviceServer();
  const phone = socketFor(server, testTicket);

  try {
    await new Promise<void>((resolve, reject) => {
      phone.addEventListener("open", () => resolve(), { once: true });
      phone.addEventListener("error", () => reject(new Error("WebSocket failed.")), { once: true });
    });
    await checkStarted.promise;
    phone.close();
    await new Promise<void>((resolve) =>
      phone.addEventListener("close", () => resolve(), { once: true }),
    );
    allowCheck.resolve(true);
    expect(
      (
        await relay.createRoutine("user-1", {
          operationId: "f490c9b0-b05f-49ee-ae09-89eb1bd48cc6",
          productName: "Magnesium",
          frequency: { kind: "as-needed" },
          time: "",
        })
      ).status,
    ).toBe("unavailable");
  } finally {
    server.stop(true);
  }
});
