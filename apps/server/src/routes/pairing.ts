import QRCode from "qrcode";
import type { Context, Hono } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";
import type { PairingChallengeRequest, PairingChallengeStatusRequest } from "@nutritual/protocol";
import { z } from "zod";
import { config } from "../neon-auth.ts";
import { createBrowserSessionVerifier } from "../browser-session.ts";
import type { PairingOperations } from "../pairing-operations.ts";

type PairingRouteDependencies = {
  publicBaseUrl: string;
  verifyBrowserSession: (token: string) => Promise<string>;
};

const defaultDependencies: PairingRouteDependencies = {
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

function remoteIp(c: Context): string {
  const forwarded = c.req
    .header("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const ip = forwarded?.at(-1) ?? "unknown";

  return ip;
}

export function registerPairingRoutes(
  app: Hono<McpAuthVariables>,
  operations: PairingOperations,
  dependencies = defaultDependencies,
): void {
  const { publicBaseUrl, verifyBrowserSession } = dependencies;
  app.post("/pairing/challenges", async (c) => {
    if (!(await operations.allowAttempt("challenge-create", remoteIp(c))))
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
    await operations.createChallenge({
      code,
      pollToken,
      oauthQuery: body.oauthQuery,
      browserSub,
      clientId,
      redirectHost,
      scopes,
      resource,
      expiresAt,
    });
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

    return c.json({
      status: await operations.challengeStatus(
        { code: body.code, pollToken: body.pollToken, oauthQuery: body.oauthQuery },
        browserSub,
      ),
    });
  });

  app.get("/pair", (c) => {
    const code = c.req.query("code") ?? "";

    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return c.text("Invalid pairing code.", 400);
    const nativeUrl = `com.erwannrousseau.nutritual:/pair?code=${encodeURIComponent(code)}`;

    return c.html(
      `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open Nutritual</title><main><h1>Open Nutritual</h1><p>Confirm the connection in the app.</p><a href="${nativeUrl}">Open the app</a></main><script>location.replace(${JSON.stringify(nativeUrl)})</script></html>`,
    );
  });
}
