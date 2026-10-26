import { expect, test } from "bun:test";
import { hasActiveSession } from "./session-model";

test("the local session remains usable until its refresh token expires", () => {
  const now = Date.parse("2026-10-25T12:00:00.000Z");

  const session = (refreshTokenExpiresAt: number) => ({
    accessToken: "a",
    refreshToken: "r",
    accessTokenExpiresAt: now - 1,
    refreshTokenExpiresAt,
  });

  expect(hasActiveSession(session(now + 1), now)).toBe(true);
  expect(hasActiveSession(session(now), now)).toBe(false);
  expect(hasActiveSession(null, now)).toBe(false);
});
