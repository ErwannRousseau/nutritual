import { expect, mock, test } from "bun:test";

const tokenKey = "nutritual.oauth.tokens";
const secureValues = new Map<string, string>();
let nextReadGate: { entered: () => void; promise: Promise<string | null> } | undefined;

mock.module("expo-secure-store", () => ({
  getItemAsync: async (key: string) => {
    const gate = nextReadGate;

    if (gate) {
      nextReadGate = undefined;
      gate.entered();

      return gate.promise;
    }

    return secureValues.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string) => {
    secureValues.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    secureValues.delete(key);
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function installFetch(implementation: (input: RequestInfo | URL) => Promise<Response>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "fetch");

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: implementation,
  });

  return () => {
    if (previous) Object.defineProperty(globalThis, "fetch", previous);
    else Reflect.deleteProperty(globalThis, "fetch");
  };
}

const expiredSession = (refreshToken: string) => ({
  accessToken: "expired-access",
  refreshToken,
  accessTokenExpiresAt: Date.now() - 60_000,
  refreshTokenExpiresAt: Date.now() + 86_400_000,
});

const freshSession = (accessToken: string, refreshToken: string) => ({
  accessToken,
  refreshToken,
  accessTokenExpiresAt: Date.now() + 3_600_000,
  refreshTokenExpiresAt: Date.now() + 86_400_000,
});

async function loadSessionModule() {
  return import("./session");
}

test("a SecureStore read started before a login cannot replace the new session", async () => {
  secureValues.set(tokenKey, JSON.stringify(expiredSession("old-refresh")));
  const { readTokens, saveTokens } = await loadSessionModule();
  const entered = deferred<void>();
  const staleRead = deferred<string | null>();
  nextReadGate = { entered: () => entered.resolve(), promise: staleRead.promise };

  const readPromise = readTokens();
  await entered.promise;

  const nextSession = freshSession("new-access", "new-refresh");
  expect(await saveTokens(nextSession)).toBe(true);
  staleRead.resolve(JSON.stringify(expiredSession("old-refresh")));

  expect(await readPromise).toEqual(nextSession);
  expect(await readTokens()).toEqual(nextSession);
});

test("a refresh response arriving after logout cannot restore the session", async () => {
  const session = await loadSessionModule();
  const expired = expiredSession("logout-refresh");
  await session.saveTokens(expired);
  const tokenResponse = deferred<Response>();
  const tokenRequestStarted = deferred<void>();

  const restoreFetch = installFetch(async (input) => {
    if (String(input).includes(".well-known")) {
      return Response.json({ token_endpoint: "https://auth.example.test/token" });
    }

    tokenRequestStarted.resolve();

    return tokenResponse.promise;
  });

  const previousIssuer = process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL;
  const previousServer = process.env.EXPO_PUBLIC_SERVER_URL;
  const previousClient = process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID;

  process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL = "https://auth.example.test";
  process.env.EXPO_PUBLIC_SERVER_URL = "https://api.example.test";
  process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID = "mobile-client";

  try {
    const refreshPromise = session.getUsableTokens();
    await tokenRequestStarted.promise;
    await session.clearTokens();
    tokenResponse.resolve(
      Response.json({
        access_token: "late-access",
        refresh_token: "late-refresh",
        expires_in: 3600,
      }),
    );

    expect(await refreshPromise).toBeNull();
    expect(await session.readTokens()).toBeNull();
    expect(secureValues.has(tokenKey)).toBe(false);
  } finally {
    restoreFetch();

    if (previousIssuer === undefined) delete process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL;
    else process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL = previousIssuer;

    if (previousServer === undefined) delete process.env.EXPO_PUBLIC_SERVER_URL;
    else process.env.EXPO_PUBLIC_SERVER_URL = previousServer;

    if (previousClient === undefined) delete process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID;
    else process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID = previousClient;
  }
});

test("a retryable refresh failure preserves the credential for the next attempt", async () => {
  const session = await loadSessionModule();
  const original = expiredSession("retryable-refresh");
  await session.saveTokens(original);
  let tokenRequests = 0;

  const restoreFetch = installFetch(async (input) => {
    if (String(input).includes(".well-known")) {
      return Response.json({ token_endpoint: "https://auth.example.test/token" });
    }

    tokenRequests += 1;

    if (tokenRequests === 1)
      return Response.json({ error: "temporarily_unavailable" }, { status: 503 });

    return Response.json({
      access_token: "recovered-access",
      refresh_token: "recovered-refresh",
      expires_in: 3600,
    });
  });

  const previousIssuer = process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL;
  const previousServer = process.env.EXPO_PUBLIC_SERVER_URL;
  const previousClient = process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID;

  process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL = "https://auth.example.test";
  process.env.EXPO_PUBLIC_SERVER_URL = "https://api.example.test";
  process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID = "mobile-client";

  try {
    expect(await session.getUsableTokens()).toBeNull();
    expect(await session.readTokens()).toEqual(original);
    expect(JSON.parse(secureValues.get(tokenKey) ?? "null")).toEqual(original);

    const recovered = await session.getUsableTokens();

    expect(recovered?.accessToken).toBe("recovered-access");
    expect(recovered?.refreshToken).toBe("recovered-refresh");
    expect(tokenRequests).toBe(2);
  } finally {
    restoreFetch();

    if (previousIssuer === undefined) delete process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL;
    else process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL = previousIssuer;

    if (previousServer === undefined) delete process.env.EXPO_PUBLIC_SERVER_URL;
    else process.env.EXPO_PUBLIC_SERVER_URL = previousServer;

    if (previousClient === undefined) delete process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID;
    else process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID = previousClient;
  }
});

test("a refresh response cannot overwrite or return after a new account signs in", async () => {
  const session = await loadSessionModule();
  await session.saveTokens(expiredSession("account-a-refresh"));
  const tokenResponse = deferred<Response>();
  const tokenRequestStarted = deferred<void>();

  const restoreFetch = installFetch(async (input) => {
    if (String(input).includes(".well-known")) {
      return Response.json({ token_endpoint: "https://auth.example.test/token" });
    }

    tokenRequestStarted.resolve();

    return tokenResponse.promise;
  });

  const previousIssuer = process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL;
  const previousServer = process.env.EXPO_PUBLIC_SERVER_URL;
  const previousClient = process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID;

  process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL = "https://auth.example.test";
  process.env.EXPO_PUBLIC_SERVER_URL = "https://api.example.test";
  process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID = "mobile-client";

  try {
    const refreshPromise = session.getUsableTokens();
    await tokenRequestStarted.promise;
    const accountB = freshSession("account-b-access", "account-b-refresh");
    expect(await session.saveTokens(accountB)).toBe(true);
    tokenResponse.resolve(
      Response.json({
        access_token: "late-account-a-access",
        refresh_token: "late-account-a-refresh",
        expires_in: 3600,
      }),
    );

    expect(await refreshPromise).toBeNull();
    expect(await session.getUsableTokens()).toEqual(accountB);
    expect(await session.readTokens()).toEqual(accountB);
    expect(JSON.parse(secureValues.get(tokenKey) ?? "null")).toEqual(accountB);
  } finally {
    restoreFetch();

    if (previousIssuer === undefined) delete process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL;
    else process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL = previousIssuer;

    if (previousServer === undefined) delete process.env.EXPO_PUBLIC_SERVER_URL;
    else process.env.EXPO_PUBLIC_SERVER_URL = previousServer;

    if (previousClient === undefined) delete process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID;
    else process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID = previousClient;
  }
});

test("a rotated refresh token without an expiry field receives a fresh 30-day lifetime", async () => {
  const session = await loadSessionModule();
  const tokenUpdates: (Awaited<ReturnType<typeof session.readTokens>> | null)[] = [];
  const unsubscribe = session.subscribeToTokenUpdates((tokens) => tokenUpdates.push(tokens));

  const old = {
    ...expiredSession("rotating-refresh"),
    refreshTokenExpiresAt: Date.now() + 10 * 86_400_000,
  };

  await session.saveTokens(old);

  const restoreFetch = installFetch(async (input) =>
    String(input).includes(".well-known")
      ? Response.json({ token_endpoint: "https://auth.example.test/token" })
      : Response.json({
          access_token: "rotated-access",
          refresh_token: "rotated-refresh",
          expires_in: 3600,
        }),
  );

  const previousIssuer = process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL;
  const previousServer = process.env.EXPO_PUBLIC_SERVER_URL;
  const previousClient = process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID;

  process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL = "https://auth.example.test";
  process.env.EXPO_PUBLIC_SERVER_URL = "https://api.example.test";
  process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID = "mobile-client";

  try {
    const refreshed = await session.getUsableTokens();

    expect(refreshed?.refreshToken).toBe("rotated-refresh");
    expect(refreshed?.refreshTokenExpiresAt).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect(tokenUpdates.at(-1)).toEqual(refreshed);
  } finally {
    unsubscribe();
    restoreFetch();

    if (previousIssuer === undefined) delete process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL;
    else process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL = previousIssuer;

    if (previousServer === undefined) delete process.env.EXPO_PUBLIC_SERVER_URL;
    else process.env.EXPO_PUBLIC_SERVER_URL = previousServer;

    if (previousClient === undefined) delete process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID;
    else process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID = previousClient;
  }
});
