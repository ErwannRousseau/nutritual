import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { Hono } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";

process.env.NEON_AUTH_BASE_URL ??= "https://auth.test.invalid";

process.env.PUBLIC_BASE_URL ??= "https://api.test.invalid";

process.env.MOBILE_OAUTH_CLIENT_ID ??= "https://mobile.test.invalid/client.json";

const { registerOAuthPages } = await import("./routes/oauth-pages.ts");

type TestEvent = { preventDefault?: () => void; currentTarget?: object };

type Listener = (event: TestEvent) => void | Promise<void>;

type AuthBody =
  | {
      email: string;
      password: string;
      name?: string;
    }
  | { selected: boolean; oauth_query: string };

const oauthQuery =
  "client_id=https%3A%2F%2Fclient.test.invalid%2Fclient.json&redirect_uri=https%3A%2F%2Fclient.test.invalid%2Fcallback&scope=openid%20mcp&state=signed%2Fstate";

const authorizationUrl = "https://auth.test.invalid/authorize?code=synthetic";

async function submitSignup(hasSession: boolean) {
  const app = new Hono<McpAuthVariables>();
  registerOAuthPages(app);
  const response = await app.request(`/oauth/login?${oauthQuery}`);
  const page = await response.text();
  const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeDefined();

  const elements = new Map<
    string,
    {
      textContent: string;
      autocomplete?: string;
      listener?: Listener;
      addEventListener?: (type: string, listener: Listener) => void;
    }
  >();

  for (const selector of [
    "#status",
    "#title",
    "#description",
    "#password",
    "#submit",
    "#toggle",
    "#form",
  ])
    elements.set(selector, {
      textContent: "",

      addEventListener(type, listener) {
        if (type === (selector === "#form" ? "submit" : "click")) this.listener = listener;
      },
    });

  const calls: { url: string; body?: AuthBody }[] = [];

  let accountCreated = false;
  let destination = "";

  await runInNewContext(script!, {
    location: { search: `?${oauthQuery}`, assign: (url: string) => (destination = url) },

    document: {
      querySelector: (selector: string) => elements.get(selector),
    },

    FormData: class {
      get(name: string) {
        return name === "email" ? "person@example.test" : "synthetic-password";
      }
    },

    fetch: async (url: string, options?: { body?: string }) => {
      // SAFETY: The test executes the page's JSON.stringify payloads and controls their values below.
      const body = options?.body ? (JSON.parse(options.body) as AuthBody) : undefined;
      calls.push({ url, body });

      if (url.endsWith("/get-session"))
        return {
          ok: true,
          json: async () => (accountCreated && hasSession ? { user: { id: "synthetic" } } : {}),
        };

      if (url.endsWith("/sign-up/email")) {
        accountCreated = true;

        return { ok: true, json: async () => ({}) };
      }

      if (url.endsWith("/oauth2/continue"))
        return { ok: true, json: async () => ({ url: authorizationUrl }) };

      throw new Error(`Unexpected auth request: ${url}`);
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  elements.get("#toggle")?.listener?.({});

  await elements.get("#form")?.listener?.({
    preventDefault() {},
    currentTarget: {},
  });

  return { calls, destination, elements };
}

test("OAuth signup creates an account then continues the original authorization request", async () => {
  const { calls, destination } = await submitSignup(true);

  expect(calls.find((call) => call.url.endsWith("/sign-up/email"))?.body).toEqual({
    email: "person@example.test",
    password: "synthetic-password",
    name: "person",
  });
  expect(calls.find((call) => call.url.endsWith("/oauth2/continue"))?.body).toEqual({
    selected: true,
    oauth_query: oauthQuery,
  });
  expect(destination).toBe(authorizationUrl);
});

test("OAuth signup waits for email verification when Neon has not created a session", async () => {
  const { calls, destination, elements } = await submitSignup(false);

  expect(calls.some((call) => call.url.endsWith("/oauth2/continue"))).toBe(false);
  expect(destination).toBe("");
  expect(elements.get("#status")?.textContent).toContain("vérification");
});
