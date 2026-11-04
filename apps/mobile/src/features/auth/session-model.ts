export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
};

export function createTokenSet(
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn?: number;
    refreshTokenExpiresIn?: number;
  },
  now = Date.now(),
): TokenSet {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: now + (tokens.expiresIn ?? 3600) * 1000,
    refreshTokenExpiresAt: now + (tokens.refreshTokenExpiresIn ?? 30 * 24 * 60 * 60) * 1000,
  };
}

export function sessionExpiryTime(session: TokenSet | null | undefined): number | undefined {
  return session?.refreshTokenExpiresAt;
}

export function hasActiveSession(session: TokenSet | null | undefined, now = Date.now()): boolean {
  const expiry = sessionExpiryTime(session);

  return expiry !== undefined && expiry > now;
}
