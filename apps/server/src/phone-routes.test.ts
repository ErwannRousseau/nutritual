import { expect, test } from "bun:test";
import { Hono, type MiddlewareHandler } from "hono";
import { Pool } from "pg";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";

process.env.NEON_AUTH_BASE_URL ??= "https://auth.test.invalid";

process.env.PUBLIC_BASE_URL ??= "https://api.test.invalid";

process.env.MOBILE_OAUTH_CLIENT_ID ??= "https://mobile.test.invalid/client.json";

const { registerPhoneRoutes } = await import("./routes/phone.ts");
const { digest } = await import("./pairing-store.ts");
const { createRoutineRelay } = await import("./routine-relay.ts");

type Challenge = { userSub: string; browserSub: string; status: string; expiresAt: Date };

type Device = { deviceId: string; secretHash: string; pairingId: string; clientId: string };

function fixture(userSub = "user-1", allowAttempt = true) {
  const challenges = new Map<string, Challenge>();
  const devices = new Map<string, Device>();
  let pairedInsertCount = 0;

  const client = {
    async query(sql: string, values: unknown[] = []) {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK")
        return { rows: [], rowCount: 0 };

      if (sql.includes("SELECT code_hash, browser_sub, client_id FROM app_pairing_challenges")) {
        // SAFETY: This SQL branch binds the challenge hash as its first parameter.
        const [codeHash] = values as string[];
        const value = challenges.get(codeHash);

        return value?.status === "pending" && value.expiresAt > new Date()
          ? {
              rows: [{ code_hash: codeHash, browser_sub: value.browserSub, client_id: "client-1" }],
              rowCount: 1,
            }
          : { rows: [], rowCount: 0 };
      }

      if (sql.includes("SET status = 'mismatch'")) {
        // SAFETY: This branch binds the string code hash as its first SQL parameter.
        const value = challenges.get(values[0] as string);

        if (value) value.status = "mismatch";

        return { rows: [], rowCount: value ? 1 : 0 };
      }

      if (sql.includes("INSERT INTO app_paired_devices")) {
        if (!sql.includes("RETURNING device_id, device_secret_hash, pairing_id, client_id"))
          throw new Error("Pairing insert must return the stored client ID");
        // SAFETY: This SQL branch binds five string parameters in the declared order.
        const [owner, deviceId, secretHash, pairingId, clientId] = values as string[];

        if (
          devices.has(owner) ||
          [...devices.values()].some((device) => device.deviceId === deviceId)
        ) {
          return { rows: [], rowCount: 0 };
        }

        const device = { deviceId, secretHash, pairingId, clientId };
        devices.set(owner, device);
        pairedInsertCount += 1;

        return {
          rows: [
            {
              device_id: deviceId,
              device_secret_hash: secretHash,
              pairing_id: pairingId,
              client_id: clientId,
            },
          ],
          rowCount: 1,
        };
      }

      if (
        sql.includes(
          "SELECT device_id, device_secret_hash, pairing_id, client_id FROM app_paired_devices",
        )
      ) {
        // SAFETY: This SQL branch binds the user subject as its first parameter.
        const device = devices.get(values[0] as string);

        return device
          ? {
              rows: [
                {
                  device_id: device.deviceId,
                  device_secret_hash: device.secretHash,
                  pairing_id: device.pairingId,
                  client_id: device.clientId,
                },
              ],
              rowCount: 1,
            }
          : { rows: [], rowCount: 0 };
      }

      if (sql.includes("UPDATE app_pairing_challenges SET status = 'approved'")) {
        // SAFETY: This SQL branch binds the challenge hash as its first parameter.
        const [codeHash] = values as string[];
        const value = challenges.get(codeHash);

        if (!value || value.status !== "pending" || value.expiresAt <= new Date())
          return { rows: [], rowCount: 0 };
        value.status = "approved";

        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected test SQL: ${sql}`);
    },
    release() {},
  };

  const database = Object.assign(new Pool({ connectionString: process.env.DATABASE_URL }), {
    async connect() {
      return client;
    },
    async query(sql: string, values: unknown[] = []) {
      if (
        sql.includes(
          "SELECT browser_sub, client_id, redirect_host, scopes, resource FROM app_pairing_challenges",
        )
      ) {
        // SAFETY: This SQL branch binds the challenge hash and browser subject in order.
        const [codeHash, browserSub] = values as string[];
        const value = challenges.get(codeHash);

        return value?.browserSub === browserSub &&
          value.status === "pending" &&
          value.expiresAt > new Date()
          ? {
              rows: [
                {
                  client_id: "https://client.example/id",
                  redirect_host: "client.example",
                  scopes: ["openid", "mcp"],
                  resource: "https://api.example/mcp",
                },
              ],
              rowCount: 1,
            }
          : { rows: [], rowCount: 0 };
      }

      if (sql.includes("UPDATE app_pairing_challenges SET status = 'declined'")) {
        // SAFETY: This SQL branch binds the code hash and browser subject in order.
        const [codeHash, browserSub] = values as string[];
        const value = challenges.get(codeHash);

        if (
          !value ||
          value.browserSub !== browserSub ||
          value.status !== "pending" ||
          value.expiresAt <= new Date()
        )
          return { rows: [], rowCount: 0 };
        value.status = "declined";

        return { rows: [], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    },
  });

  const app = new Hono<McpAuthVariables>();

  const authGuard: MiddlewareHandler<McpAuthVariables> = async (c, next) => {
    // SAFETY: The tested handlers consume only the verified subject from this auth result.
    // SAFETY: This test middleware supplies the verified auth subject consumed by the route.
    c.set("auth", { sub: userSub } as McpAuthVariables["Variables"]["auth"]);
    await next();
  };

  registerPhoneRoutes(app, createRoutineRelay(), {
    database,
    digest,
    rateLimit: async () => allowAttempt,
    ready: async () => undefined,
    ticketLifetimeMs: 60_000,
    authGuard,
  });

  return {
    app,
    challenges,
    devices,
    get pairedInsertCount() {
      return pairedInsertCount;
    },
  };
}

test("authenticated phone inspection finds a pending challenge before approval binds its subject", async () => {
  const state = fixture("user-1");
  const code = "ABCD-2345";
  state.challenges.set(digest(code), {
    userSub: "user-1",
    browserSub: "user-1",
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000),
  });

  const response = await state.app.request("/api/phone/pairing-challenges/inspect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    status: "pending",
    details: {
      clientId: "https://client.example/id",
      redirectHost: "client.example",
      scope: ["openid", "mcp"],
      resource: "https://api.example/mcp",
    },
  });

  const otherUser = fixture("user-2");
  otherUser.challenges.set(digest(code), {
    userSub: "user-1",
    browserSub: "user-1",
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000),
  });

  const denied = await otherUser.app.request("/api/phone/pairing-challenges/inspect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });

  expect(denied.status).toBe(404);
  expect(await denied.json()).toEqual({ status: "expired" });
});

test("a different account cannot approve or decline another browser's challenge", async () => {
  const otherUser = fixture("user-2");
  const code = "ABCD-2345";

  const challenge = {
    userSub: "user-1",
    browserSub: "user-1",
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000),
  };

  otherUser.challenges.set(digest(code), challenge);

  const request = {
    code,
    deviceId: "device-2",
    deviceSecret: "a-secure-random-device-secret-value-123456",
  };

  const approval = await otherUser.app.request("/api/phone/pairing-challenges/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  const decline = await otherUser.app.request("/api/phone/pairing-challenges/decline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });

  expect(approval.status).toBe(409);
  expect(decline.status).toBe(404);
  expect(challenge.status).toBe("pending");
  expect(otherUser.pairedInsertCount).toBe(0);
});

test("phone approval is explicit, single-use, and rejects replacing a paired device", async () => {
  const state = fixture();
  const code = "ABCD-2345";
  state.challenges.set(digest(code), {
    userSub: "user-1",
    browserSub: "user-1",
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000),
  });

  const request = {
    code,
    deviceId: "device-1",
    deviceSecret: "a-secure-random-device-secret-value-123456",
  };

  const first = await state.app.request("/api/phone/pairing-challenges/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  const replay = await state.app.request("/api/phone/pairing-challenges/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  expect(first.status).toBe(200);
  expect(await first.json()).toEqual({ status: "approved" });
  expect(replay.status).toBe(404);
  expect(state.pairedInsertCount).toBe(1);

  const replacement = fixture();
  replacement.devices.set("user-1", {
    deviceId: "old-device",
    secretHash: digest("old-device-secret"),
    pairingId: "pairing-1",
    clientId: "client-1",
  });
  replacement.challenges.set(digest(code), {
    userSub: "user-1",
    browserSub: "user-1",
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000),
  });

  const rejected = await replacement.app.request("/api/phone/pairing-challenges/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });

  expect(rejected.status).toBe(409);
  expect(await rejected.json()).toEqual({ error: "device_already_paired" });
});

test("phone approval safely rejects a browser and phone account mismatch", async () => {
  const state = fixture("user-b");
  const code = "ABCD-2345";
  state.challenges.set(digest(code), {
    userSub: "",
    browserSub: "user-a",
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000),
  });

  const response = await state.app.request("/api/phone/pairing-challenges/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code,
      deviceId: "device-b",
      deviceSecret: "a-secure-random-device-secret-value-123456",
    }),
  });

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "account_mismatch" });
  expect(state.pairedInsertCount).toBe(0);
  expect(state.challenges.get(digest(code))?.status).toBe("pending");
});

test("phone code guesses are durably rate limited", async () => {
  const state = fixture("user-1", false);

  const response = await state.app.request("/api/phone/pairing-challenges/inspect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: "ABCD-2345" }),
  });

  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: "rate_limited" });
});
