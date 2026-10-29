import { expect, test } from "bun:test";
import { approvalRequestSchema, codeRequestSchema, deviceRequestSchema } from "../phone-schemas.ts";

test("code request schema accepts only formatted pairing codes", () => {
  expect(codeRequestSchema.safeParse({ code: "ABCD-2345" }).success).toBe(true);
  expect(codeRequestSchema.safeParse({ code: "abcd-2345" }).success).toBe(false);
  expect(codeRequestSchema.safeParse({ code: "ABCD2345" }).success).toBe(false);
});

test("approval request schema validates code, device ID, and secret", () => {
  const valid = { code: "ABCD-2345", deviceId: "device-1", deviceSecret: "a-secure-random-device-secret-value-123456" };
  expect(approvalRequestSchema.safeParse(valid).success).toBe(true);
  expect(approvalRequestSchema.safeParse({ ...valid, deviceId: "bad id" }).success).toBe(false);
  expect(approvalRequestSchema.safeParse({ ...valid, deviceSecret: "short" }).success).toBe(false);
});

test("device request schema validates device credentials", () => {
  expect(deviceRequestSchema.safeParse({ deviceId: "device-1", deviceSecret: "a-secure-random-device-secret-value-123456" }).success).toBe(true);
  expect(deviceRequestSchema.safeParse({ deviceId: "device-1" }).success).toBe(false);
});
