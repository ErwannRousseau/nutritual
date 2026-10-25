import { expect, test } from "bun:test";
import { hasActiveSession } from "./session";

test("local routine access ends when the persisted session expires", () => {
  const now = Date.parse("2026-10-25T12:00:00.000Z");

  expect(hasActiveSession({ session: { expiresAt: "2026-10-25T12:00:01.000Z" } }, now)).toBe(true);
  expect(hasActiveSession({ session: { expiresAt: "2026-10-25T12:00:00.000Z" } }, now)).toBe(false);
  expect(hasActiveSession({ session: { expiresAt: "invalid" } }, now)).toBe(false);
});
