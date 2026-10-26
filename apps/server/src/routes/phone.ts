import type { Context } from "hono";
import type { Hono, MiddlewareHandler } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";
import { z } from "zod";
import type {
  DeviceTicketResponse,
  PairingChallengeInspectionResponse,
  PairingStatusResponse,
} from "@nutritual/protocol";
import { authVerifier } from "../neon-auth.ts";
import { database, digest, rateLimit, ready } from "../pairing-store.ts";
import { ticketLifetimeMs } from "./device.ts";
import type { RoutineRelay } from "../routine-relay.ts";

const codePattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const idPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const secretPattern = /^[A-Za-z0-9_-]{32,256}$/;
const codeRequestSchema = z.object({ code: z.string().regex(codePattern) });

const approvalRequestSchema = z.object({
  code: z.string().regex(codePattern),
  deviceId: z.string().regex(idPattern),
  deviceSecret: z.string().regex(secretPattern),
});

const deviceRequestSchema = z.object({
  deviceId: z.string().regex(idPattern),
  deviceSecret: z.string().regex(secretPattern),
});

type PhoneRouteDependencies = {
  database: typeof database;
  digest: typeof digest;
  rateLimit: typeof rateLimit;
  ready: typeof ready;
  ticketLifetimeMs: number;
  authGuard: MiddlewareHandler<McpAuthVariables>;
};

const bearerGuard = authVerifier.requireBearerAuth();

const defaultAuthGuard: MiddlewareHandler<McpAuthVariables> = async (c, next) => {
  const auth = await bearerGuard(c.req.raw);

  if (auth instanceof Response) return auth;

  c.set("auth", auth);
  await next();
};

const defaultDependencies: PhoneRouteDependencies = {
  database,
  digest,
  rateLimit,
  ready,
  ticketLifetimeMs,
  authGuard: defaultAuthGuard,
};

function ipKey(c: Context): string {
  const forwarded = c.req
    .header("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const ip = forwarded?.at(-1) ?? "unknown";

  return digest(`pairing:${ip}`);
}

async function hasDevice(
  userSub: string,
  database: typeof import("../pairing-store.ts").database,
): Promise<boolean> {
  const result = await database.query("SELECT 1 FROM app_paired_devices WHERE user_sub = $1", [
    userSub,
  ]);

  return (result.rowCount ?? 0) > 0;
}

export function registerPhoneRoutes(
  app: Hono<McpAuthVariables>,
  relay: RoutineRelay,
  dependencies = defaultDependencies,
): void {
  const { database, digest, rateLimit, ready, ticketLifetimeMs, authGuard } = dependencies;
  app.use("/api/phone/*", authGuard);
  app.post("/api/phone/pairing-challenges/inspect", async (c) => {
    const parsed = codeRequestSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) return c.json({ status: "expired" as const }, 404);
    const body = parsed.data;

    if (!(await rateLimit(ipKey(c)))) return c.json({ error: "rate_limited" }, 429);
    await ready();

    const result = await database.query<{
      browser_sub: string;
      client_id: string;
      redirect_host: string;
      scopes: string[];
      resource: string | null;
    }>(
      `SELECT browser_sub, client_id, redirect_host, scopes, resource FROM app_pairing_challenges WHERE code_hash = $1 AND browser_sub = $2 AND status = 'pending' AND expires_at > now()`,
      [digest(body.code), c.get("auth").sub],
    );

    const challenge = result.rows[0];

    if (!challenge) return c.json({ status: "expired" as const }, 404);

    const response: PairingChallengeInspectionResponse = {
      status: "pending",
      details: {
        clientId: challenge.client_id,
        redirectHost: challenge.redirect_host,
        scope: challenge.scopes,
        resource: challenge.resource,
      },
    };

    return c.json(response);
  });

  app.post("/api/phone/pairing-challenges/approve", async (c) => {
    const parsed = approvalRequestSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
    const body = parsed.data;

    if (!(await rateLimit(ipKey(c)))) return c.json({ error: "rate_limited" }, 429);
    await ready();
    const client = await database.connect();

    try {
      await client.query("BEGIN");

      const challenge = await client.query<{
        code_hash: string;
        browser_sub: string;
        client_id: string;
      }>(
        `SELECT code_hash, browser_sub, client_id FROM app_pairing_challenges WHERE code_hash = $1 AND status = 'pending' AND expires_at > now() FOR UPDATE`,
        [digest(body.code)],
      );

      if (!challenge.rowCount) {
        await client.query("ROLLBACK");

        return c.json({ error: "challenge_unavailable" }, 404);
      }

      if (challenge.rows[0]?.browser_sub !== c.get("auth").sub) {
        await client.query("ROLLBACK");

        return c.json({ error: "account_mismatch" }, 409);
      }

      const secretHash = digest(body.deviceSecret);

      const paired = await client.query<{
        device_id: string;
        device_secret_hash: string;
        pairing_id: string;
        client_id: string;
      }>(
        `INSERT INTO app_paired_devices (user_sub, device_id, device_secret_hash, pairing_id, client_id)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING
         RETURNING device_id, device_secret_hash, pairing_id, client_id`,
        [
          c.get("auth").sub,
          body.deviceId,
          secretHash,
          crypto.randomUUID(),
          challenge.rows[0]!.client_id,
        ],
      );

      let device = paired.rows[0];

      if (!device) {
        const existing = await client.query<{
          device_id: string;
          device_secret_hash: string;
          pairing_id: string;
          client_id: string;
        }>(
          `SELECT device_id, device_secret_hash, pairing_id, client_id FROM app_paired_devices WHERE user_sub = $1 FOR UPDATE`,
          [c.get("auth").sub],
        );

        device = existing.rows[0];
      }

      if (
        !device ||
        device.device_id !== body.deviceId ||
        device.device_secret_hash !== secretHash ||
        device.client_id !== challenge.rows[0]!.client_id
      ) {
        await client.query("ROLLBACK");

        return c.json({ error: "device_already_paired" }, 409);
      }

      const approved = await client.query(
        `UPDATE app_pairing_challenges SET status = 'approved', user_sub = $2, device_id = $3
         WHERE code_hash = $1 AND status = 'pending' AND expires_at > now()`,
        [digest(body.code), c.get("auth").sub, body.deviceId],
      );

      if (!approved.rowCount) {
        await client.query("ROLLBACK");

        return c.json({ error: "challenge_unavailable" }, 404);
      }

      await client.query("COMMIT");

      return c.json({ status: "approved" as const });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/api/phone/pairing-challenges/decline", async (c) => {
    const parsed = codeRequestSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
    const body = parsed.data;

    if (!(await rateLimit(ipKey(c)))) return c.json({ error: "rate_limited" }, 429);
    await ready();

    const result = await database.query(
      `UPDATE app_pairing_challenges SET status = 'declined', user_sub = $2 WHERE code_hash = $1 AND browser_sub = $2 AND status = 'pending' AND expires_at > now()`,
      [digest(body.code), c.get("auth").sub],
    );

    return result.rowCount
      ? c.json({ status: "declined" as const })
      : c.json({ error: "challenge_unavailable" }, 404);
  });

  app.get("/api/phone/pairing-status", async (c) => {
    await ready();

    const response: PairingStatusResponse = {
      paired: await hasDevice(c.get("auth").sub, database),
    };

    return c.json(response);
  });

  app.post("/api/phone/disconnect", async (c) => {
    const parsed = deviceRequestSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
    const body = parsed.data;
    await ready();

    const result = await database.query(
      `DELETE FROM app_paired_devices WHERE user_sub = $1 AND device_id = $2 AND device_secret_hash = $3 RETURNING pairing_id`,
      [c.get("auth").sub, body.deviceId, digest(body.deviceSecret)],
    );

    const pairingId = result.rows[0]?.pairing_id;

    if (!pairingId) return c.json({ error: "invalid_device_credentials" }, 401);
    relay.disconnectPairedPhone(c.get("auth").sub, body.deviceId, pairingId);
    await database.query("DELETE FROM app_device_tickets WHERE user_sub = $1 AND pairing_id = $2", [
      c.get("auth").sub,
      pairingId,
    ]);

    return c.json({ paired: false });
  });

  app.post("/api/phone/device-ticket", async (c) => {
    const parsed = deviceRequestSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
    const body = parsed.data;
    await ready();

    const paired = await database.query<{ pairing_id: string }>(
      `SELECT pairing_id FROM app_paired_devices WHERE user_sub = $1 AND device_id = $2 AND device_secret_hash = $3`,
      [c.get("auth").sub, body.deviceId, digest(body.deviceSecret)],
    );

    if (!paired.rowCount) return c.json({ error: "invalid_device_credentials" }, 401);
    const ticket = crypto.randomUUID() + crypto.randomUUID();
    const response: DeviceTicketResponse = { ticket };
    await database.query(
      `INSERT INTO app_device_tickets (ticket_hash, user_sub, device_id, pairing_id, expires_at) VALUES ($1, $2, $3, $4, $5)`,
      [
        digest(ticket),
        c.get("auth").sub,
        body.deviceId,
        paired.rows[0]!.pairing_id,
        new Date(Date.now() + ticketLifetimeMs),
      ],
    );

    return c.json(response);
  });
}
