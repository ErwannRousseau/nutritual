import { expect, test } from "bun:test";
import type { PairingOAuthRequestDetails } from "@nutritual/protocol";
import {
  decidePairing,
  inspectPairingCode,
  pairingDecisionCode,
  type PairingFlowServices,
} from "./pairing-flow";

const details: PairingOAuthRequestDetails = {
  clientId: "client.example",
  redirectHost: "example.com",
  scope: ["routine:create"],
  resource: null,
};

test("malformed and changed codes cannot authorize a pairing decision", () => {
  expect(pairingDecisionCode("bad code", true, "BADCODE")).toBeNull();
  expect(pairingDecisionCode("BBBB-BBBB", true, "AAAA-AAAA")).toBeNull();
  expect(pairingDecisionCode("AAAA-AAAA", false, "AAAA-AAAA")).toBeNull();
});

test("inspection stores the normalized code after the server accepts it", async () => {
  const events: string[] = [];

  const result = await inspectPairingCode(
    "AAAA-AAAA",
    createServices({
      inspect: async (code) => {
        events.push(`inspect:${code}`);

        return details;
      },
      storePendingCode: async (code) => {
        events.push(`store:${code}`);
      },
    }),
  );

  expect(result).toEqual({
    details,
    message: "Code valide. Vérifiez les autorisations ci-dessous.",
  });
  expect(events).toEqual(["inspect:AAAA-AAAA", "store:AAAA-AAAA"]);
});

test("inspection failure keeps the pending code and reports the existing message", async () => {
  let stored = false;

  const result = await inspectPairingCode(
    "AAAA-AAAA",
    createServices({
      inspect: async () => {
        throw new Error("request failed");
      },
      storePendingCode: async () => {
        stored = true;
      },
    }),
  );

  expect(result.details).toBeNull();
  expect(result.message).toBe(
    "Code invalide, expiré ou associé à un autre compte. Vérifiez le compte et réessayez.",
  );
  expect(stored).toBe(false);
});

test("approval sends device credentials and only then clears the code and schedules navigation", async () => {
  const events: string[] = [];
  let complete: (() => void) | undefined;
  let message = "";

  await decidePairing(
    "AAAA-AAAA",
    true,
    createServices({
      getDeviceCredentials: async () => {
        events.push("credentials");

        return { deviceId: "device-id", deviceSecret: "device-secret" };
      },
      approve: async (code, device) => {
        events.push(`approve:${code}:${device.deviceId}:${device.deviceSecret}`);
      },
      deletePendingCode: async () => {
        events.push("delete");
      },
      schedule: (callback, delay) => {
        events.push(`schedule:${delay}`);
        complete = callback;
      },
      navigateToSettings: () => events.push("navigate"),
    }),
    (nextMessage) => {
      message = nextMessage;
      events.push(`message:${nextMessage}`);
    },
  );

  expect(message).toBe("L’application est jumelée à ce téléphone.");
  expect(events).toEqual([
    "credentials",
    "approve:AAAA-AAAA:device-id:device-secret",
    "message:L’application est jumelée à ce téléphone.",
    "delete",
    "schedule:700",
  ]);
  complete?.();
  expect(events.at(-1)).toBe("navigate");
});

test("approval failure does not delete the pending code or schedule navigation", async () => {
  let deleted = false;
  let scheduled = false;
  let message = "";

  await decidePairing(
    "AAAA-AAAA",
    true,
    createServices({
      approve: async () => {
        throw new Error("request failed");
      },
      deletePendingCode: async () => {
        deleted = true;
      },
      schedule: () => {
        scheduled = true;
      },
    }),
    (nextMessage) => {
      message = nextMessage;
    },
  );

  expect(message).toBe("Impossible de traiter ce jumelage. Vérifiez le code et réessayez.");
  expect(deleted).toBe(false);
  expect(scheduled).toBe(false);
});

test("decline posts only the validated code and never requests device credentials", async () => {
  const events: string[] = [];
  let message = "";

  await decidePairing(
    "AAAA-AAAA",
    false,
    createServices({
      getDeviceCredentials: async () => {
        events.push("credentials");

        return { deviceId: "device-id", deviceSecret: "device-secret" };
      },
      decline: async (code) => {
        events.push(`decline:${code}`);
      },
      deletePendingCode: async () => {
        events.push("delete");
      },
      schedule: (_callback, delay) => events.push(`schedule:${delay}`),
    }),
    (nextMessage) => {
      message = nextMessage;
    },
  );

  expect(message).toBe("Demande refusée.");
  expect(events).toEqual(["decline:AAAA-AAAA", "delete", "schedule:700"]);
});

function createServices(overrides: Partial<PairingFlowServices> = {}): PairingFlowServices {
  return {
    inspect: async () => details,
    approve: async () => {},
    decline: async () => {},
    getDeviceCredentials: async () => ({ deviceId: "device-id", deviceSecret: "device-secret" }),
    storePendingCode: async () => {},
    deletePendingCode: async () => {},
    schedule: () => {},
    navigateToSettings: () => {},
    ...overrides,
  };
}
