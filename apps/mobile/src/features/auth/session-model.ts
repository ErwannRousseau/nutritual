export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
};

export function sessionExpiryTime(session: TokenSet | null | undefined): number | undefined {
  return session?.refreshTokenExpiresAt;
}

export function hasActiveSession(session: TokenSet | null | undefined, now = Date.now()): boolean {
  const expiry = sessionExpiryTime(session);

  return expiry !== undefined && expiry > now;
}
