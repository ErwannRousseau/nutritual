import { afterAll, expect, test } from "bun:test";
import { CreateRoutineDeliveryStatus } from "@nutritual/protocol";
import { createRoutineRelay } from "./routine-relay.ts";

process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:1/test";

process.env.NEON_AUTH_BASE_URL = "https://auth.example.invalid";

process.env.PUBLIC_BASE_URL = "https://api.example.invalid";

process.env.MOBILE_OAUTH_CLIENT_ID = "https://mobile.example.invalid/client.json";

process.env.NODE_ENV = "test";

const { app } = await import("./app.ts");
const { isRoutineToolError } = await import("./routes/mcp.ts");
const { canUseMcpClient } = await import("./pairing-operations.ts");

test("GET /health keeps its successful health response", async () => {
  const response = await app.request("/health");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("the old unauthenticated routine relay route is removed", async () => {
  const response = await app.request("/intake-routines", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });

  expect(response.status).toBe(404);
});

test("MCP and phone APIs reject missing bearer credentials", async () => {
  const phoneResponse = await app.request("/api/phone/pairing-status");
  const mcpResponse = await app.request("/mcp", { method: "POST" });
  expect(phoneResponse.status).toBe(401);
  expect(mcpResponse.status).toBe(401);
});

test("relay isolates connected phones by authenticated user", async () => {
  const relay = createRoutineRelay();
  const sent: string[] = [];
  await relay.connectPhone(
    "user-a",
    {
      id: "device-a",
      deviceId: "paired-device-a",
      pairingId: "pairing-a",
      send: (message) => sent.push(message),
      close: () => undefined,
    },
    async () => true,
  );

  const result = await relay.createRoutine("user-b", {
    operationId: "3b5d754f-00e6-451e-974f-fcbd180b3a6a",
    productName: "Magnesium",
    frequency: { kind: "as-needed" },
    time: "",
  });

  expect(result.status).toBe(CreateRoutineDeliveryStatus.unavailable);
  expect(sent).toEqual([]);
});

test("a replaced socket close cannot disconnect the newer socket for the same device", async () => {
  const relay = createRoutineRelay();
  const firstSent: string[] = [];
  const secondSent: string[] = [];
  await relay.connectPhone(
    "user-a",
    {
      id: "connection-1",
      deviceId: "device-a",
      pairingId: "pairing-a",
      send: (message) => firstSent.push(message),
      close: () => undefined,
    },
    async () => true,
  );
  await relay.connectPhone(
    "user-a",
    {
      id: "connection-2",
      deviceId: "device-a",
      pairingId: "pairing-a",
      send: (message) => secondSent.push(message),
      close: () => undefined,
    },
    async () => true,
  );
  relay.disconnectPhone("user-a", "connection-1");

  const pending = relay.createRoutine("user-a", {
    operationId: "f490c9b0-b05f-49ee-ae09-89eb1bd48cc6",
    productName: "Magnesium",
    frequency: { kind: "as-needed" },
    time: "",
  });

  await Promise.resolve();
  expect(firstSent).toEqual([]);
  expect(secondSent).toHaveLength(1);
  relay.disconnectPhone("user-a", "connection-2");
  expect((await pending).status).toBe(CreateRoutineDeliveryStatus.unconfirmed);
});

test("rejected pairing and revoked pending pairing stay unavailable after late approval", async () => {
  const relay = createRoutineRelay();
  expect(
    (
      await relay.createRoutine("user-a", {
        operationId: "c6d611b7-b4a7-427a-bce1-50c3a2815d88",
        productName: "Magnesium",
        frequency: { kind: "as-needed" },
        time: "",
      })
    ).status,
  ).toBe(CreateRoutineDeliveryStatus.unavailable);

  await relay.connectPhone(
    "user-a",
    {
      id: "rejected",
      deviceId: "device-a",
      pairingId: "pairing-1",
      send: () => undefined,
      close: () => undefined,
    },
    async () => false,
  );
  expect(
    (
      await relay.createRoutine("user-a", {
        operationId: "c6d611b7-b4a7-427a-bce1-50c3a2815d88",
        productName: "Magnesium",
        frequency: { kind: "as-needed" },
        time: "",
      })
    ).status,
  ).toBe(CreateRoutineDeliveryStatus.unavailable);

  await relay.connectPhone(
    "user-a",
    {
      id: "lookup-failed",
      deviceId: "device-a",
      pairingId: "pairing-1",
      send: () => undefined,
      close: () => undefined,
    },
    async () => {
      throw new Error("Pairing lookup failed.");
    },
  );

  expect(
    (
      await relay.createRoutine("user-a", {
        operationId: "c6d611b7-b4a7-427a-bce1-50c3a2815d88",
        productName: "Magnesium",
        frequency: { kind: "as-needed" },
        time: "",
      })
    ).status,
  ).toBe(CreateRoutineDeliveryStatus.unavailable);

  let allowPairing!: (paired: boolean) => void;

  const admission = relay.connectPhone(
    "user-a",
    {
      id: "revoked-pending",
      deviceId: "device-a",
      pairingId: "pairing-1",
      send: () => undefined,
      close: () => undefined,
    },
    () => new Promise((resolve) => (allowPairing = resolve)),
  );

  relay.disconnectPairedPhone("user-a", "device-a", "pairing-1");
  allowPairing(true);
  await admission;

  expect(
    (
      await relay.createRoutine("user-a", {
        operationId: "c6d611b7-b4a7-427a-bce1-50c3a2815d88",
        productName: "Magnesium",
        frequency: { kind: "as-needed" },
        time: "",
      })
    ).status,
  ).toBe(CreateRoutineDeliveryStatus.unavailable);
});

test("revoking an old pairing does not disconnect its replacement", async () => {
  const relay = createRoutineRelay();
  const currentSent: string[] = [];
  await relay.connectPhone(
    "user-a",
    {
      id: "old",
      deviceId: "device-a",
      pairingId: "pairing-1",
      send: () => undefined,
      close: () => undefined,
    },
    async () => true,
  );
  await relay.connectPhone(
    "user-a",
    {
      id: "new",
      deviceId: "device-a",
      pairingId: "pairing-2",
      send: (message) => currentSent.push(message),
      close: () => undefined,
    },
    async () => true,
  );

  relay.disconnectPairedPhone("user-a", "device-a", "pairing-1");

  const pending = relay.createRoutine("user-a", {
    operationId: "f490c9b0-b05f-49ee-ae09-89eb1bd48cc6",
    productName: "Magnesium",
    frequency: { kind: "as-needed" },
    time: "",
  });

  await Promise.resolve();
  expect(currentSent).toHaveLength(1);
  relay.disconnectPhone("user-a", "new");
  expect((await pending).status).toBe(CreateRoutineDeliveryStatus.unconfirmed);
});

test("MCP reports every non-successful routine outcome as a tool error", () => {
  expect(isRoutineToolError("created")).toBe(false);
  expect(isRoutineToolError("already_processed")).toBe(false);
  expect(isRoutineToolError("unavailable")).toBe(true);
  expect(isRoutineToolError("unconfirmed")).toBe(true);
  expect(isRoutineToolError("conflict")).toBe(true);
  expect(isRoutineToolError("invalid")).toBe(true);
  expect(isRoutineToolError("failed")).toBe(true);
});

test("MCP rejects another OAuth client and the first-party mobile client", () => {
  expect(canUseMcpClient("approved-chat-client", "approved-chat-client", "mobile-client")).toBe(
    true,
  );
  expect(canUseMcpClient("different-client", "approved-chat-client", "mobile-client")).toBe(false);
  expect(canUseMcpClient("mobile-client", "mobile-client", "mobile-client")).toBe(false);
});

afterAll(async () => {
  // The test suite uses no database operations; the pool is kept unopened.
});
