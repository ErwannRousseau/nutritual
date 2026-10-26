import { expect, test } from "bun:test";
import { Hono } from "hono";
import { Pool } from "pg";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";

process.env.NEON_AUTH_BASE_URL ??= "https://auth.test.invalid";

process.env.PUBLIC_BASE_URL ??= "https://api.test.invalid";

process.env.MOBILE_OAUTH_CLIENT_ID ??= "https://mobile.test.invalid/client.json";

const { registerPairingRoutes } = await import("./routes/pairing.ts");
const { registerOAuthPages } = await import("./routes/oauth-pages.ts");
const { createPairingStore, digest } = await import("./pairing-store.ts");
const { createPairingOperations } = await import("./pairing-operations.ts");
const { createRoutineRelay } = await import("./routine-relay.ts");

type StoredChallenge = {
  codeHash: string;
  pollHash: string;
  oauthHash: string;
  expiresAt: Date;
  status: string;
  browserSub: string;
  consumedAt: Date | null;
};

const challenges = new Map<string, StoredChallenge>();

const fakeDatabase = Object.assign(new Pool({ connectionString: process.env.DATABASE_URL }), {
  async query(sql: string, values: unknown[] = []) {
    if (sql.includes("INSERT INTO app_pairing_challenges")) {
      // SAFETY: This SQL branch binds three hash strings and one expiry date in order.
      const [codeHash, pollHash, oauthHash, browserSub, , , , , expiresAt] = values as [
        string,
        string,
        string,
        string,
        string,
        string,
        string[],
        string | null,
        Date,
      ];

      challenges.set(codeHash, {
        codeHash,
        pollHash,
        oauthHash,
        expiresAt,
        status: "pending",
        browserSub,
        consumedAt: null,
      });

      return { rows: [], rowCount: 1 };
    }

    if (sql.includes("SELECT status, expires_at, consumed_at, browser_sub")) {
      // SAFETY: The SQL branch binds the three challenge hashes in order.
      const [codeHash, pollHash, oauthHash] = values as string[];
      const row = challenges.get(codeHash);

      if (!row || row.pollHash !== pollHash || row.oauthHash !== oauthHash)
        return { rows: [], rowCount: 0 };

      return {
        rows: [
          {
            status: row.status,
            expires_at: row.expiresAt,
            consumed_at: row.consumedAt,
            browser_sub: row.browserSub,
          },
        ],
        rowCount: 1,
      };
    }

    if (sql.includes("UPDATE app_pairing_challenges SET consumed_at")) {
      // SAFETY: The SQL branch binds the same challenge hashes as the lookup.
      const [codeHash, pollHash, oauthHash] = values as string[];
      const row = challenges.get(codeHash);

      if (
        !row ||
        row.pollHash !== pollHash ||
        row.oauthHash !== oauthHash ||
        row.consumedAt ||
        row.expiresAt <= new Date()
      ) {
        return { rows: [], rowCount: 0 };
      }

      row.consumedAt = new Date();

      return { rows: [{ status: row.status }], rowCount: 1 };
    }

    throw new Error(`Unexpected test SQL: ${sql}`);
  },
});

const app = new Hono<McpAuthVariables>();

const store = createPairingStore({
  database: fakeDatabase,
  digest,
  rateLimit: async () => true,
  ready: async () => undefined,
});

registerPairingRoutes(app, createPairingOperations(store, createRoutineRelay()), {
  publicBaseUrl: "https://api.test.invalid",
  verifyBrowserSession: async (token) => {
    if (token === "other-browser-session") return "other-user";

    if (token !== "valid-browser-session") throw new Error("invalid");

    return "browser-user";
  },
});

registerOAuthPages(app);

async function createChallenge(oauthQuery: string) {
  const response = await app.request("/pairing/challenges", {
    method: "POST",
    headers: { "content-type": "application/json", "x-neon-session-jwt": "valid-browser-session" },
    body: JSON.stringify({ oauthQuery }),
  });

  expect(response.status).toBe(201);

  // SAFETY: The endpoint returned 201, so its body follows PairingChallengeResponse.
  return (await response.json()) as {
    code: string;
    pollToken: string;
    qrUrl: string;
    expiresAt: string;
  };
}

test("pairing challenge requires a browser session and persists hashes of realistic provider query", async () => {
  const oauthQuery =
    "client_id=https%3A%2F%2Fchatgpt.com%2Fclient.json&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fconnector%2Foauth&response_type=code&scope=openid%20mcp&resource=https%3A%2F%2Fapi.example%2Fmcp&state=signed";

  const unauthorized = await app.request("/pairing/challenges", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ oauthQuery }),
  });

  expect(unauthorized.status).toBe(401);

  const created = await createChallenge(oauthQuery);
  const row = challenges.get(digest(created.code));
  expect(row).toBeDefined();
  expect(row?.pollHash).not.toBe(created.pollToken);
  expect(row?.oauthHash).toBe(digest(oauthQuery));
  expect(Date.parse(created.expiresAt) - Date.now()).toBeGreaterThan(4 * 60_000);
  expect(Date.parse(created.expiresAt) - Date.now()).toBeLessThanOrEqual(5 * 60_000);
  expect(created.qrUrl.startsWith("data:image/png;base64,")).toBe(true);
});

test("pairing terminal status is one-time and an expired challenge cannot be consumed", async () => {
  const oauthQuery =
    "client_id=client&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&scope=openid&state=signed-request";

  const created = await createChallenge(oauthQuery);
  const row = challenges.get(digest(created.code))!;
  row.status = "approved";
  const body = JSON.stringify({ code: created.code, pollToken: created.pollToken, oauthQuery });

  const otherAccount = await app.request("/pairing/challenges/status", {
    method: "POST",
    headers: { "content-type": "application/json", "x-neon-session-jwt": "other-browser-session" },
    body,
  });

  expect(await otherAccount.json()).toEqual({ status: "mismatch" });
  expect(row.consumedAt).toBeNull();

  const first = await app.request("/pairing/challenges/status", {
    method: "POST",
    headers: { "content-type": "application/json", "x-neon-session-jwt": "valid-browser-session" },
    body,
  });

  const replay = await app.request("/pairing/challenges/status", {
    method: "POST",
    headers: { "content-type": "application/json", "x-neon-session-jwt": "valid-browser-session" },
    body,
  });

  expect(await first.json()).toEqual({ status: "approved" });
  expect(await replay.json()).toEqual({ status: "expired" });

  const expiredQuery =
    "client_id=client&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&scope=openid&state=another-signed-request";

  const expired = await createChallenge(expiredQuery);
  challenges.get(digest(expired.code))!.expiresAt = new Date(Date.now() - 1);

  const response = await app.request("/pairing/challenges/status", {
    method: "POST",
    headers: { "content-type": "application/json", "x-neon-session-jwt": "valid-browser-session" },
    body: JSON.stringify({
      code: expired.code,
      pollToken: expired.pollToken,
      oauthQuery: expiredQuery,
    }),
  });

  expect(await response.json()).toEqual({ status: "expired" });
});

test("OAuth pages preserve raw provider query and bridge callback values unchanged", async () => {
  const query =
    "client_id=https%3A%2F%2Fchatgpt.com%2Fclient.json&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fconnector%2Foauth&response_type=code&scope=openid%20mcp&resource=https%3A%2F%2Fapi.example%2Fmcp&state=state-123&extra=%2Fkeep";

  const consentPage = await app.request(`/oauth/consent?${query}`);
  const consentHtml = await consentPage.text();
  expect(consentHtml).toContain("oauth_query:query");
  expect(consentHtml).toContain("'x-neon-session-jwt':sessionJwt");
  expect(consentHtml).toContain("/oauth2/consent");
  expect(consentHtml).toContain('id="allow"');
  expect(consentHtml).toContain("addEventListener('click',()=>consent(true))");

  const loginPage = await app.request(`/oauth/login?${query}`);
  const loginHtml = await loginPage.text();
  expect(loginHtml).toContain("oauth_query:query");
  expect(loginHtml).toContain("/oauth2/continue");

  const callback = await app.request("/oauth/mobile/callback?code=abc%2B123&state=state%2Fok", {
    redirect: "manual",
  });

  expect(callback.status).toBe(302);
  expect(callback.headers.get("location")).toBe(
    "com.erwannrousseau.nutritual:/oauth/callback?code=abc%2B123&state=state%2Fok",
  );

  const bridge = await app.request("/pair?code=ABCD-2345");
  expect(bridge.status).toBe(200);
  expect(await bridge.text()).toContain("com.erwannrousseau.nutritual:/pair?code=ABCD-2345");
});
