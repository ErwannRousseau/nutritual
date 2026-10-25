import * as SecureStore from "expo-secure-store";
import { isJsonObject, type JsonValue } from "@/auth/parse";
import { hasActiveSession, type TokenSet } from "@/auth/session-model";

export { hasActiveSession, sessionExpiryTime } from "@/auth/session-model";

export type { TokenSet } from "@/auth/session-model";

const TOKEN_KEY = "nutritual.oauth.tokens";

let sessionGeneration = 0;
let memoryTokens: TokenSet | null | undefined;
let secureStoreWriteQueue: Promise<void> = Promise.resolve();
let refreshPromise: { generation: number; promise: Promise<TokenSet | null> } | undefined;
const tokenListeners = new Set<(tokens: TokenSet | null) => void>();

export function subscribeToTokenUpdates(listener: (tokens: TokenSet | null) => void): () => void {
  tokenListeners.add(listener);

  return () => tokenListeners.delete(listener);
}

function publishTokenUpdate(tokens: TokenSet | null): void {
  for (const listener of tokenListeners) listener(tokens);
}

function parseTokenSet(value: JsonValue): TokenSet | null {
  if (!isJsonObject(value)) return null;

  const accessTokenValue = value.accessToken;
  const refreshTokenValue = value.refreshToken;
  const accessTokenExpiresAtValue = value.accessTokenExpiresAt;
  const refreshTokenExpiresAtValue = value.refreshTokenExpiresAt;
  const accessToken = String(accessTokenValue ?? "");
  const refreshToken = String(refreshTokenValue ?? "");
  const accessTokenExpiresAt = Number(accessTokenExpiresAtValue);
  const refreshTokenExpiresAt = Number(refreshTokenExpiresAtValue);

  if (
    !accessToken ||
    accessToken !== accessTokenValue ||
    !refreshToken ||
    refreshToken !== refreshTokenValue
  )
    return null;

  if (!Number.isFinite(accessTokenExpiresAt) || accessTokenExpiresAt !== accessTokenExpiresAtValue)
    return null;

  if (
    !Number.isFinite(refreshTokenExpiresAt) ||
    refreshTokenExpiresAt !== refreshTokenExpiresAtValue
  )
    return null;

  return { accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt };
}

function parseRefreshResponse(value: JsonValue) {
  if (!isJsonObject(value)) return null;

  const accessTokenValue = value.access_token;
  const refreshTokenValue = value.refresh_token;
  const expiresInValue = value.expires_in;
  const refreshTokenExpiresInValue = value.refresh_token_expires_in;
  const accessToken = String(accessTokenValue ?? "");
  const refreshToken = String(refreshTokenValue ?? "");
  const expiresIn = Number(expiresInValue);

  const refreshTokenExpiresIn =
    refreshTokenExpiresInValue === undefined ? undefined : Number(refreshTokenExpiresInValue);

  if (
    !accessToken ||
    accessToken !== accessTokenValue ||
    !refreshToken ||
    refreshToken !== refreshTokenValue
  )
    return null;

  if (!Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn !== expiresInValue) return null;

  if (
    refreshTokenExpiresIn !== undefined &&
    (!Number.isFinite(refreshTokenExpiresIn) ||
      refreshTokenExpiresIn <= 0 ||
      refreshTokenExpiresIn !== refreshTokenExpiresInValue)
  )
    return null;

  return { accessToken, refreshToken, expiresIn, refreshTokenExpiresIn };
}

function enqueueSecureStoreWrite<T>(write: () => Promise<T>): Promise<T> {
  const result = secureStoreWriteQueue.then(write, write);

  secureStoreWriteQueue = result.then(
    () => undefined,
    () => undefined,
  );

  return result;
}

function isCurrentSession(generation: number, tokens: TokenSet): boolean {
  return generation === sessionGeneration && memoryTokens === tokens;
}

export async function readTokens(): Promise<TokenSet | null> {
  if (memoryTokens !== undefined) return memoryTokens;

  const generation = sessionGeneration;

  try {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);

    if (generation !== sessionGeneration) return memoryTokens ?? null;

    if (!raw) {
      memoryTokens = null;

      return null;
    }

    const parsed = parseTokenSet(JSON.parse(raw));
    memoryTokens = parsed && hasActiveSession(parsed) ? parsed : null;

    return memoryTokens;
  } catch {
    if (generation !== sessionGeneration) return memoryTokens ?? null;

    memoryTokens = null;

    return null;
  }
}

export async function saveTokens(tokens: TokenSet): Promise<boolean> {
  const generation = ++sessionGeneration;
  memoryTokens = tokens;

  const saved = await enqueueSecureStoreWrite(async () => {
    if (!isCurrentSession(generation, tokens)) return false;

    await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));

    return isCurrentSession(generation, tokens);
  });

  if (saved && isCurrentSession(generation, tokens)) publishTokenUpdate(tokens);

  return saved;
}

export async function clearTokens(): Promise<void> {
  ++sessionGeneration;
  memoryTokens = null;
  publishTokenUpdate(null);

  await enqueueSecureStoreWrite(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  });
}

export async function getUsableTokens(): Promise<TokenSet | null> {
  const current = await readTokens();
  const generation = sessionGeneration;

  if (!current || !isCurrentSession(generation, current)) return null;

  if (current.accessTokenExpiresAt > Date.now() + 30_000) return current;

  if (refreshPromise?.generation !== generation) {
    const promise = refreshTokens(current, generation);

    refreshPromise = { generation, promise };
    void promise.then(
      () => {
        if (refreshPromise?.promise === promise) refreshPromise = undefined;
      },
      () => {
        if (refreshPromise?.promise === promise) refreshPromise = undefined;
      },
    );
  }

  return refreshPromise.promise;
}

async function clearIfCurrent(generation: number, current: TokenSet): Promise<void> {
  if (isCurrentSession(generation, current)) await clearTokens();
}

async function isDefinitiveGrantFailure(response: Response): Promise<boolean> {
  try {
    const error: JsonValue = await response.json();

    return isJsonObject(error) && error.error === "invalid_grant";
  } catch {
    return false;
  }
}

async function refreshTokens(current: TokenSet, generation: number): Promise<TokenSet | null> {
  const issuer = process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL;
  const server = process.env.EXPO_PUBLIC_SERVER_URL?.replace(/\/$/, "");

  if (!issuer || !server || !isCurrentSession(generation, current)) return null;

  try {
    const discoveryResponse = await fetch(
      `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
    );

    const discovery: JsonValue = await discoveryResponse.json();

    if (!isCurrentSession(generation, current) || !isJsonObject(discovery)) return null;

    const tokenEndpoint = String(discovery.token_endpoint ?? "");

    if (!tokenEndpoint || tokenEndpoint !== discovery.token_endpoint) return null;

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: current.refreshToken,
        client_id: process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID ?? "",
        resource: `${server}/mcp`,
      }).toString(),
    });

    if (!isCurrentSession(generation, current)) return null;

    if (!response.ok) {
      if (await isDefinitiveGrantFailure(response)) await clearIfCurrent(generation, current);

      return null;
    }

    const data: JsonValue = await response.json();
    const result = parseRefreshResponse(data);

    if (!result) return null;

    const next: TokenSet = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessTokenExpiresAt: Date.now() + result.expiresIn * 1000,
      refreshTokenExpiresAt: result.refreshTokenExpiresIn
        ? Date.now() + result.refreshTokenExpiresIn * 1000
        : Date.now() + 30 * 24 * 60 * 60 * 1000,
    };

    const committed = await enqueueSecureStoreWrite(async () => {
      if (!isCurrentSession(generation, current)) return false;

      await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(next));

      if (!isCurrentSession(generation, current)) return false;

      memoryTokens = next;
      publishTokenUpdate(next);

      return true;
    });

    return committed && generation === sessionGeneration ? next : null;
  } catch {
    return null;
  }
}
