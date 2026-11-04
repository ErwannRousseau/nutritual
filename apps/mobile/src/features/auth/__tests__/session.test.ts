import { expect, test } from "bun:test";
import { createTokenSet, hasActiveSession } from "../session-model";

test("token lifetimes are converted from seconds using the same reference time", () => {
  const now = Date.parse("2026-10-25T12:00:00.000Z");

  const session = createTokenSet(
    { accessToken: "a", refreshToken: "r", expiresIn: 120, refreshTokenExpiresIn: 600 },
    now,
  );

  expect(session).toEqual({
    accessToken: "a",
    refreshToken: "r",
    accessTokenExpiresAt: now + 120_000,
    refreshTokenExpiresAt: now + 600_000,
  });
});

test("missing token lifetimes default to one hour and thirty days", () => {
  const now = Date.parse("2026-10-25T12:00:00.000Z");
  const session = createTokenSet({ accessToken: "a", refreshToken: "r" }, now);

  expect(session.accessTokenExpiresAt).toBe(now + 3_600_000);
  expect(session.refreshTokenExpiresAt).toBe(now + 2_592_000_000);
});

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
