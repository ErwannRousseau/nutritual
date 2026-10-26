import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { Hono } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";

process.env.NEON_AUTH_BASE_URL ??= "https://auth.test.invalid";

process.env.PUBLIC_BASE_URL ??= "https://api.test.invalid";

process.env.MOBILE_OAUTH_CLIENT_ID ??= "https://mobile.test.invalid/client.json";

const { registerOAuthPages } = await import("./routes/oauth-pages.ts");
const { config } = await import("./neon-auth.ts");
const mobileClientId = config.mobileClientId;

type TestEvent = { preventDefault?: () => void; currentTarget?: object };

type Listener = (event: TestEvent) => void | Promise<void>;

type TestElement = {
  textContent: string;
  autocomplete?: string;
  hidden?: boolean;
  src?: string;
  listener?: Listener;
  addEventListener?: (type: string, listener: Listener) => void;
};

type AuthBody =
  | {
      email: string;
      password: string;
      name?: string;
      oauth_query?: string;
    }
  | { selected: boolean; oauth_query: string };

type ConsentBody =
  | { accept: boolean; oauth_query: string }
  | { oauthQuery: string }
  | { code: string; pollToken: string; oauthQuery: string };

type PageRequestBody = AuthBody | ConsentBody;

const oauthQuery =
  "client_id=https%3A%2F%2Fclient.test.invalid%2Fclient.json&redirect_uri=https%3A%2F%2Fclient.test.invalid%2Fcallback&scope=openid%20mcp&state=signed%2Fstate";

const mobileOAuthQuery = oauthQuery.replace(
  /^client_id=[^&]*/,
  `client_id=${encodeURIComponent(mobileClientId)}`,
);

const authorizationUrl = "https://auth.test.invalid/authorize?code=synthetic";
const consentQuery = `${oauthQuery}&exp=2000&sig=consent-signature`;
const consentUrl = `${config.publicBaseUrl}/oauth/consent?${consentQuery}`;
const deniedUrl = "https://client.test.invalid/callback?error=access_denied&state=signed%2Fstate";

async function getServedPageScript(app: Hono<McpAuthVariables>, path: string) {
  const pageResponse = await app.request(path);
  expect(pageResponse.status).toBe(200);
  const page = await pageResponse.text();
  expect(page.startsWith("<!doctype html>")).toBe(true);
  const scriptPath = page.match(/<script[^>]*src="([^"]+)"/)?.[1];
  expect(scriptPath).toBeDefined();
  const scriptResponse = await app.request(scriptPath!);
  expect(scriptResponse.status).toBe(200);
  expect(scriptResponse.headers.get("content-type")).toStartWith("text/javascript");

  return { page, script: await scriptResponse.text() };
}

async function runLoginPage(
  options: {
    query?: string;
    sessionAtStart?: boolean;
    signUp?: boolean;
    sessionAfterSignup?: boolean;
    pairingStatus?: "approved" | "declined" | "mismatch" | "expired";
    nextUrl?: string;
    denialFails?: boolean;
  } = {},
) {
  const query = options.query ?? oauthQuery;
  const app = new Hono<McpAuthVariables>();
  registerOAuthPages(app);
  const { page, script } = await getServedPageScript(app, `/oauth/login?${query}`);
  expect(page).toContain(`data-auth-base-url="${config.authBaseUrl}"`);

  const elements = new Map<string, TestElement>();

  for (const selector of [
    "#status",
    "#title",
    "#description",
    "#password",
    "#submit",
    "#toggle",
    "#form",
    "#pair",
    "#qr",
    "#code",
    "#requestDetails",
  ])
    elements.set(selector, {
      textContent: "",
      hidden: selector === "#pair",

      addEventListener(type, listener) {
        if (type === (selector === "#form" ? "submit" : "click")) this.listener = listener;
      },
    });

  const calls: { url: string; body?: PageRequestBody }[] = [];
  let hasSession = options.sessionAtStart ?? false;
  let destination = "";
  const sessionStorageValues = new Map<string, string>();

  await runInNewContext(script, {
    location: {
      href: `${config.publicBaseUrl}/oauth/login?${query}`,
      origin: new URL(config.publicBaseUrl).origin,
      search: `?${query}`,
      assign: (url: string) => (destination = url),
    },

    document: {
      querySelector: (selector: string) => elements.get(selector),
      currentScript: {
        dataset: { authBaseUrl: config.authBaseUrl, mobileClientId: config.mobileClientId },
      },
    },

    FormData: class {
      get(name: string) {
        return name === "email" ? "person@example.test" : "synthetic-password";
      }
    },
    URLSearchParams,
    URL,
    sessionStorage: {
      setItem(key: string, value: string) {
        sessionStorageValues.set(key, value);
      },
    },

    fetch: async (url: string, request?: { body?: string }) => {
      // SAFETY: The test executes the page's JSON.stringify payloads and controls their values below.
      const body = request?.body ? (JSON.parse(request.body) as PageRequestBody) : undefined;
      calls.push({ url, body });

      if (url.endsWith("/get-session"))
        return {
          ok: true,
          headers: { get: () => (hasSession ? "synthetic-session-jwt" : null) },
          json: async () => (hasSession ? { user: { id: "synthetic" } } : {}),
        };

      if (url.endsWith("/sign-up/email")) {
        hasSession = options.sessionAfterSignup ?? false;

        return { ok: true, json: async () => ({}) };
      }

      if (url.endsWith("/sign-in/email")) {
        hasSession = true;

        return { ok: true, json: async () => ({ url: options.nextUrl ?? authorizationUrl }) };
      }

      if (url.endsWith("/oauth2/continue"))
        return { ok: true, json: async () => ({ url: options.nextUrl ?? authorizationUrl }) };

      if (url.endsWith("/oauth2/consent"))
        return {
          ok: !options.denialFails,
          json: async () =>
            options.denialFails ? { message: "Refus impossible." } : { url: deniedUrl },
        };

      if (url === "/pairing/challenges")
        return {
          ok: true,
          json: async () => ({
            code: "SYNTHETIC",
            pollToken: "synthetic-poll-token",
            qrUrl: "data:image/png;base64,synthetic",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          }),
        };

      if (url === "/pairing/challenges/status")
        return {
          ok: true,
          json: async () => ({ status: options.pairingStatus ?? "approved" }),
        };

      throw new Error(`Unexpected auth request: ${url}`);
    },
    setTimeout: (callback: () => void) => queueMicrotask(callback),
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  return {
    calls,
    get destination() {
      return destination;
    },
    elements,
    sessionStorageValues,
    async submit() {
      if (options.signUp) await elements.get("#toggle")?.listener?.({});

      await elements.get("#form")?.listener?.({
        preventDefault() {},
        currentTarget: {},
      });
    },
  };
}

async function runConsentPage(
  query: string,
  options: { decision?: "allow" | "deny"; pairedQuery?: string } = {},
) {
  const app = new Hono<McpAuthVariables>();
  registerOAuthPages(app);
  const { page, script } = await getServedPageScript(app, `/oauth/consent?${query}`);
  expect(page).toContain(`data-auth-base-url="${config.authBaseUrl}"`);
  expect(page).toContain(`data-mobile-client-id="${config.mobileClientId}"`);

  const elements = new Map<
    string,
    {
      textContent: string;
      hidden?: boolean;
      src?: string;
      listener?: Listener;
      addEventListener: (type: string, listener: Listener) => void;
    }
  >();

  for (const selector of ["#status", "#explanation", "#mobile", "#details", "#allow", "#deny"])
    elements.set(selector, {
      textContent: "",
      hidden: true,
      addEventListener(_type, listener) {
        this.listener = listener;
      },
    });

  const calls: { url: string; body?: ConsentBody }[] = [];
  let destination = "";
  let replacement = "";
  const sessionStorageValues = new Map<string, string>();

  if (options.pairedQuery)
    sessionStorageValues.set("nutritual-paired-oauth-query", options.pairedQuery);

  await runInNewContext(script, {
    location: {
      search: `?${query}`,
      assign: (url: string) => (destination = url),
      replace: (url: string) => (replacement = url),
    },
    document: {
      querySelector: (selector: string) => elements.get(selector),
      currentScript: {
        dataset: {
          authBaseUrl: config.authBaseUrl,
          mobileClientId: config.mobileClientId,
        },
      },
    },
    URLSearchParams,
    sessionStorage: {
      getItem(key: string) {
        return sessionStorageValues.get(key) ?? null;
      },
      removeItem(key: string) {
        sessionStorageValues.delete(key);
      },
    },
    fetch: async (url: string, request?: { body?: string }) => {
      // SAFETY: This test parses JSON produced by the page and controls every response below.
      const body = request?.body ? (JSON.parse(request.body) as ConsentBody) : undefined;
      calls.push({ url, body });

      if (url.endsWith("/oauth2/consent"))
        return { ok: true, json: async () => ({ url: authorizationUrl }) };
      throw new Error(`Unexpected consent request: ${url}`);
    },
    setTimeout: (callback: () => void) => queueMicrotask(callback),
  });

  if (query === mobileOAuthQuery) {
    const selector = options.decision === "deny" ? "#deny" : "#allow";
    await elements.get(selector)?.listener?.({});
  }

  await new Promise((resolve) => setTimeout(resolve, 0));

  return { calls, destination, replacement, elements, sessionStorageValues };
}

test("OAuth signup creates an account then continues the original authorization request", async () => {
  const flow = await runLoginPage({ signUp: true, sessionAfterSignup: true, nextUrl: consentUrl });
  await flow.submit();

  expect(flow.calls.find((call) => call.url.endsWith("/sign-up/email"))?.body).toEqual({
    email: "person@example.test",
    password: "synthetic-password",
    name: "person",
  });
  expect(flow.calls.find((call) => call.url.endsWith("/oauth2/continue"))?.body).toEqual({
    selected: true,
    oauth_query: oauthQuery,
  });
  expect(flow.calls.findIndex((call) => call.url === "/pairing/challenges/status")).toBeLessThan(
    flow.calls.findIndex((call) => call.url.endsWith("/oauth2/continue")),
  );
  const pairedQuery = flow.sessionStorageValues.get("nutritual-paired-oauth-query");
  expect(pairedQuery).toBe(consentQuery);
  expect(flow.destination).toBe(consentUrl);
  const consent = await runConsentPage(consentQuery, { pairedQuery });
  expect(consent.replacement).toBe("");
  expect(consent.destination).toBe(authorizationUrl);
});

test("OAuth signup waits for email verification when Neon has not created a session", async () => {
  const flow = await runLoginPage({ signUp: true, sessionAfterSignup: false });
  await flow.submit();

  expect(flow.calls.some((call) => call.url.endsWith("/oauth2/continue"))).toBe(false);
  expect(flow.destination).toBe("");
  expect(flow.elements.get("#status")?.textContent).toContain("vérification");
});

test("OAuth login does not continue a ChatGPT request from an existing Neon session", async () => {
  const loginQuery = `${oauthQuery}&exp=1000&sig=login-signature`;

  const flow = await runLoginPage({
    sessionAtStart: true,
    query: loginQuery,
    nextUrl: consentUrl,
  });

  expect(flow.calls.some((call) => call.url.endsWith("/oauth2/continue"))).toBe(false);
  expect(flow.destination).toBe("");
  expect(flow.elements.get("#status")?.textContent).toContain("Reconnectez-vous");

  await flow.submit();

  expect(flow.calls.find((call) => call.url.endsWith("/sign-in/email"))?.body).toEqual({
    email: "person@example.test",
    password: "synthetic-password",
    oauth_query: loginQuery,
  });
  expect(flow.calls.find((call) => call.url === "/pairing/challenges")?.body).toEqual({
    oauthQuery: loginQuery,
  });
  expect(flow.calls.find((call) => call.url === "/pairing/challenges/status")?.body).toEqual({
    code: "SYNTHETIC",
    pollToken: "synthetic-poll-token",
    oauthQuery: loginQuery,
  });
  expect(flow.elements.get("#pair")?.hidden).toBe(false);
  expect(flow.elements.get("#code")?.textContent).toBe("SYNTHETIC");
  const pairedQuery = flow.sessionStorageValues.get("nutritual-paired-oauth-query");
  expect(pairedQuery).toBe(consentQuery);
  expect(flow.destination).toBe(consentUrl);
  const consent = await runConsentPage(consentQuery, { pairedQuery });
  expect(consent.replacement).toBe("");
  expect(consent.destination).toBe(authorizationUrl);
});

test("OAuth login sends the phone refusal to the provider after signup or sign-in", async () => {
  for (const signUp of [true, false]) {
    const flow = await runLoginPage({
      signUp,
      sessionAfterSignup: true,
      pairingStatus: "declined",
    });

    await flow.submit();

    expect(flow.calls.find((call) => call.url.endsWith("/oauth2/consent"))?.body).toEqual({
      accept: false,
      oauth_query: oauthQuery,
    });
    expect(flow.calls.findIndex((call) => call.url === "/pairing/challenges/status")).toBeLessThan(
      flow.calls.findIndex((call) => call.url.endsWith("/oauth2/consent")),
    );
    expect(flow.calls.some((call) => call.url.endsWith("/oauth2/continue"))).toBe(false);
    expect(flow.destination).toBe(deniedUrl);
    expect(flow.sessionStorageValues.size).toBe(0);
  }
});

test("OAuth login reports a failed refusal without continuing authorization", async () => {
  const flow = await runLoginPage({ pairingStatus: "declined", denialFails: true });
  await flow.submit();

  expect(flow.destination).toBe("");
  expect(flow.elements.get("#status")?.textContent).toBe("Refus impossible.");
});

test("OAuth login stops if the phone has a different account or the challenge expires", async () => {
  for (const [pairingStatus, statusText] of [
    ["mismatch", "ne correspondent pas"],
    ["expired", "expiré"],
  ] as const) {
    const flow = await runLoginPage({ signUp: true, sessionAfterSignup: true, pairingStatus });
    await flow.submit();

    expect(flow.calls.some((call) => call.url.endsWith("/oauth2/continue"))).toBe(false);
    expect(flow.calls.some((call) => call.url.endsWith("/oauth2/consent"))).toBe(false);
    expect(flow.destination).toBe("");
    expect(flow.elements.get("#status")?.textContent).toContain(statusText);
  }
});

test("OAuth login follows an already authorized callback without storing a consent query", async () => {
  for (const signUp of [true, false]) {
    const flow = await runLoginPage({ signUp, sessionAfterSignup: true });
    await flow.submit();

    expect(flow.destination).toBe(authorizationUrl);
    expect(flow.sessionStorageValues.size).toBe(0);
  }
});

test("mobile OAuth still continues an existing Neon session", async () => {
  const flow = await runLoginPage({ query: mobileOAuthQuery, sessionAtStart: true });

  expect(flow.calls.find((call) => call.url.endsWith("/oauth2/continue"))?.body).toEqual({
    selected: true,
    oauth_query: mobileOAuthQuery,
  });
  expect(flow.calls.some((call) => call.url === "/pairing/challenges")).toBe(false);
  expect(flow.destination).toBe(authorizationUrl);
});

test("mobile OAuth consent allows and denies with the original query", async () => {
  for (const accept of [true, false]) {
    const { calls, destination } = await runConsentPage(mobileOAuthQuery, {
      decision: accept ? "allow" : "deny",
    });

    expect(calls.find((call) => call.url.endsWith("/oauth2/consent"))?.body).toEqual({
      accept,
      oauth_query: mobileOAuthQuery,
    });
    expect(destination).toBe(authorizationUrl);
  }
});

test("ChatGPT OAuth consent completes after pairing without creating a second challenge", async () => {
  const { calls, destination, sessionStorageValues } = await runConsentPage(oauthQuery, {
    pairedQuery: oauthQuery,
  });

  expect(calls.some((call) => call.url.startsWith("/pairing/challenges"))).toBe(false);
  expect(calls.find((call) => call.url.endsWith("/oauth2/consent"))?.body).toEqual({
    accept: true,
    oauth_query: oauthQuery,
  });
  expect(destination).toBe(authorizationUrl);
  expect(sessionStorageValues.has("nutritual-paired-oauth-query")).toBe(false);
});

test("ChatGPT OAuth consent returns to login when the request was not paired", async () => {
  for (const pairedQuery of [undefined, oauthQuery]) {
    const { calls, destination, replacement } = await runConsentPage(consentQuery, { pairedQuery });

    expect(calls.some((call) => call.url.endsWith("/oauth2/consent"))).toBe(false);
    expect(destination).toBe("");
    expect(replacement).toBe(`/oauth/login?${consentQuery}`);
  }
});
