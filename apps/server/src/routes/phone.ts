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
import type { PairingOperations } from "../pairing-operations.ts";

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
  authGuard: defaultAuthGuard,
};

function remoteIp(c: Context): string {
  const forwarded = c.req
    .header("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const ip = forwarded?.at(-1) ?? "unknown";

  return ip;
}

export function registerPhoneRoutes(
  app: Hono<McpAuthVariables>,
  operations: PairingOperations,
  dependencies = defaultDependencies,
): void {
  const { authGuard } = dependencies;
  app.use("/api/phone/*", authGuard);
  app.post("/api/phone/pairing-challenges/inspect", async (c) => {
    const parsed = codeRequestSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) return c.json({ status: "expired" as const }, 404);
    const body = parsed.data;

    if (!(await operations.allowAttempt("pairing", remoteIp(c))))
      return c.json({ error: "rate_limited" }, 429);
    const challenge = await operations.inspectChallenge(body.code, c.get("auth").sub);

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

    if (!(await operations.allowAttempt("pairing", remoteIp(c))))
      return c.json({ error: "rate_limited" }, 429);
    const result = await operations.approveChallenge(body, c.get("auth").sub);

    if (result === "approved") return c.json({ status: "approved" as const });

    if (result === "account_mismatch" || result === "device_already_paired")
      return c.json({ error: result }, 409);

    return c.json({ error: "challenge_unavailable" }, 404);
  });

  app.post("/api/phone/pairing-challenges/decline", async (c) => {
    const parsed = codeRequestSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
    const body = parsed.data;

    if (!(await operations.allowAttempt("pairing", remoteIp(c))))
      return c.json({ error: "rate_limited" }, 429);
    const declined = await operations.declineChallenge(body.code, c.get("auth").sub);

    return declined
      ? c.json({ status: "declined" as const })
      : c.json({ error: "challenge_unavailable" }, 404);
  });

  app.get("/api/phone/pairing-status", async (c) => {
    const response: PairingStatusResponse = {
      paired: await operations.pairingStatus(c.get("auth").sub),
    };

    return c.json(response);
  });

  app.post("/api/phone/disconnect", async (c) => {
    const parsed = deviceRequestSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
    const body = parsed.data;

    if (!(await operations.disconnect(c.get("auth").sub, body.deviceId, body.deviceSecret)))
      return c.json({ error: "invalid_device_credentials" }, 401);

    return c.json({ paired: false });
  });

  app.post("/api/phone/device-ticket", async (c) => {
    const parsed = deviceRequestSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) return c.json({ error: "invalid_request" }, 400);
    const body = parsed.data;

    const ticket = await operations.issueDeviceTicket(
      c.get("auth").sub,
      body.deviceId,
      body.deviceSecret,
    );

    if (!ticket) return c.json({ error: "invalid_device_credentials" }, 401);
    const response: DeviceTicketResponse = { ticket };

    return c.json(response);
  });
}
