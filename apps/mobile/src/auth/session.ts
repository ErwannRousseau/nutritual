type SessionData = { session: { expiresAt: Date | string } } | null | undefined;

export function sessionExpiryTime(session: SessionData): number | undefined {
  if (!session) return undefined;

  const expiresAt = session.session.expiresAt;
  const expiresAtTime = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);

  return Number.isFinite(expiresAtTime) ? expiresAtTime : undefined;
}

export function hasActiveSession(session: SessionData, now = Date.now()): boolean {
  const expiresAtTime = sessionExpiryTime(session);

  return expiresAtTime !== undefined && expiresAtTime > now;
}
