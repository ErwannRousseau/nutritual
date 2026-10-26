import { expect, test } from "bun:test";
import { deviceWebSocketUrl } from "./relay-url";
import { phoneResponses } from "./phone-responses";
import type { PairingChallengeInspectionResponse } from "@nutritual/protocol";

test("device relay URL includes the one-time ticket and uses secure WebSockets", () => {
  expect(deviceWebSocketUrl("https://api.example.test", "one-time ticket")).toBe(
    "wss://api.example.test/device?ticket=one-time+ticket",
  );
});

test("disconnect accepts the server's paired=false response", () => {
  expect(phoneResponses.disconnected({ paired: false })).toBe(true);
});

test("pairing inspection validates and accepts the complete OAuth request details", () => {
  const response: PairingChallengeInspectionResponse = {
    status: "pending",
    details: {
      clientId: "chatgpt-client",
      redirectHost: "chatgpt.com",
      scope: ["openid", "offline_access"],
      resource: "https://api.example.test/mcp",
    },
  };

  expect(phoneResponses.pending(response)).toBe(true);
  expect(
    phoneResponses.pending({ ...response, details: { ...response.details, scope: ["openid", 7] } }),
  ).toBe(false);
  expect(phoneResponses.pending({ status: "pending" })).toBe(false);
});
