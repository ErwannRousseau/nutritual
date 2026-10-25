import QRCode from "qrcode";
import type { Context, Hono } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";
import type { PairingChallengeRequest, PairingChallengeStatusRequest } from "@nutritual/protocol";
import { z } from "zod";
import { config } from "../neon-auth.ts";
import { database, digest, rateLimit, ready } from "../pairing-store.ts";
import { createBrowserSessionVerifier } from "../browser-session.ts";

type PairingRouteDependencies = {
  database: typeof database;
  digest: typeof digest;
  rateLimit: typeof rateLimit;
  ready: typeof ready;
  publicBaseUrl: string;
  verifyBrowserSession: (token: string) => Promise<string>;
};

const defaultDependencies: PairingRouteDependencies = {
  database,
  digest,
  rateLimit,
  ready,
  publicBaseUrl: config.publicBaseUrl,
  verifyBrowserSession: createBrowserSessionVerifier(config.authBaseUrl),
};

const challengeLifetimeMs = 5 * 60_000;
const codeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const challengeRequestSchema = z.object({ oauthQuery: z.string().min(1).max(8192) });

const challengeStatusSchema = z.object({
  code: z.string().min(1).max(64),
  pollToken: z.string().min(1).max(256),
  oauthQuery: z.string().min(1).max(8192),
});

function randomCode(): string {
  const random = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...random].map((value) => codeAlphabet[value % codeAlphabet.length]);

  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

function remoteKey(c: Context, kind: string): string {
  const forwarded = c.req
    .header("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const ip = forwarded?.at(-1) ?? "unknown";

  return digest(`${kind}:${ip}`);
}

export function registerPairingRoutes(
  app: Hono<McpAuthVariables>,
  dependencies = defaultDependencies,
): void {
  const { database, digest, rateLimit, ready, publicBaseUrl, verifyBrowserSession } = dependencies;
  app.post("/pairing/challenges", async (c) => {
    if (!(await rateLimit(remoteKey(c, "challenge-create"))))
      return c.json({ error: "rate_limited" }, 429);
    const parsed = challengeRequestSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
    const body: PairingChallengeRequest = parsed.data;
    const sessionToken = c.req.header("x-neon-session-jwt");

    if (!sessionToken) return c.json({ error: "unauthorized" }, 401);
    let browserSub: string;

    try {
      browserSub = await verifyBrowserSession(sessionToken);
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }

    const query = new URLSearchParams(body.oauthQuery);
    const clientId = query.get("client_id")?.slice(0, 512);
    const redirectUri = query.get("redirect_uri");
    let redirectHost: string;

    try {
      if (!redirectUri) throw new Error("Missing redirect URI.");
      redirectHost = new URL(redirectUri).host.slice(0, 255);
    } catch {
      return c.json({ error: "invalid_oauth_request" }, 400);
    }

    if (!clientId) return c.json({ error: "invalid_oauth_request" }, 400);
    const scopes = (query.get("scope") ?? "").split(/\s+/).filter(Boolean).slice(0, 64);
    const resource = query.get("resource")?.slice(0, 1024) ?? null;

    const code = randomCode();
    const pollToken = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + challengeLifetimeMs);
    const qrUrl = `${publicBaseUrl}/pair?code=${encodeURIComponent(code)}`;
    await ready();
    await database.query(
      `INSERT INTO app_pairing_challenges (
         code_hash, poll_token_hash, oauth_query_hash, browser_sub, user_sub,
         client_id, redirect_host, scopes, resource, status, expires_at
       ) VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, 'pending', $9)`,
      [
        digest(code),
        digest(pollToken),
        digest(body.oauthQuery),
        browserSub,
        clientId,
        redirectHost,
        scopes,
        resource,
        expiresAt,
      ],
    );
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { errorCorrectionLevel: "M", margin: 1 });

    return c.json({ code, pollToken, qrUrl: qrDataUrl, expiresAt: expiresAt.toISOString() }, 201);
  });

  app.post("/pairing/challenges/status", async (c) => {
    const parsed = challengeStatusSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
    const body: PairingChallengeStatusRequest = parsed.data;
    const sessionToken = c.req.header("x-neon-session-jwt");

    if (!sessionToken) return c.json({ error: "unauthorized" }, 401);
    let browserSub: string;

    try {
      browserSub = await verifyBrowserSession(sessionToken);
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }

    await ready();

    const result = await database.query<{
      status: string;
      expires_at: Date;
      consumed_at: Date | null;
      browser_sub: string;
    }>(
      `SELECT status, expires_at, consumed_at, browser_sub FROM app_pairing_challenges
       WHERE code_hash = $1 AND poll_token_hash = $2 AND oauth_query_hash = $3`,
      [digest(body.code), digest(body.pollToken), digest(body.oauthQuery)],
    );

    const challenge = result.rows[0];

    if (!challenge || challenge.expires_at <= new Date() || challenge.consumed_at)
      return c.json({ status: "expired" as const });

    if (challenge.browser_sub !== browserSub) return c.json({ status: "mismatch" as const });

    if (challenge.status !== "pending") {
      const consumed = await database.query<{ status: string }>(
        `UPDATE app_pairing_challenges SET consumed_at = now()
         WHERE code_hash = $1 AND poll_token_hash = $2 AND oauth_query_hash = $3 AND consumed_at IS NULL
         AND expires_at > now()
         RETURNING status`,
        [digest(body.code), digest(body.pollToken), digest(body.oauthQuery)],
      );

      if (!consumed.rowCount) return c.json({ status: "expired" as const });

      return c.json({ status: consumed.rows[0]?.status });
    }

    return c.json({ status: challenge.status });
  });

  app.get("/pair", (c) => {
    const code = c.req.query("code") ?? "";

    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return c.text("Code d’association invalide.", 400);
    const nativeUrl = `com.erwannrousseau.nutritual:/pair?code=${encodeURIComponent(code)}`;

    return c.html(
      `<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ouvrir Nutritual</title><main><h1>Ouvrir Nutritual</h1><p>Confirmez la connexion dans l’application.</p><a href="${nativeUrl}">Ouvrir l’application</a></main><script>location.replace(${JSON.stringify(nativeUrl)})</script></html>`,
    );
  });
}
