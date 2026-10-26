import { expect, test } from "bun:test";
import { Pool } from "pg";
import { createRoutineRelay } from "./routine-relay.ts";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";

const { createPairingStore, digest } = await import("./pairing-store.ts");
const { createPairingOperations } = await import("./pairing-operations.ts");

type Device = {
  device_id: string;
  device_secret_hash: string;
  pairing_id: string;
  client_id: string;
};

function fixture(options: { device?: Device; failApproval?: boolean } = {}) {
  const challenge = { browserSub: "user-1", clientId: "client-1", status: "pending" };
  const devices = new Map<string, Device>();

  if (options.device) devices.set("user-1", options.device);
  const statements: string[] = [];
  const tickets = new Map<string, { userSub: string; deviceId: string; pairingId: string }>();
  const consumedTickets = new Set<string>();
  let deletedTicketsPairingId: string | undefined;
  let releaseCount = 0;

  const client = {
    async query(sql: string, values: unknown[] = []) {
      statements.push(sql);

      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: 0 };

      if (sql.includes("SELECT browser_sub, client_id FROM app_pairing_challenges"))
        return challenge.status === "pending"
          ? {
              rows: [{ browser_sub: challenge.browserSub, client_id: challenge.clientId }],
              rowCount: 1,
            }
          : { rows: [], rowCount: 0 };

      if (sql.includes("INSERT INTO app_paired_devices")) {
        // SAFETY: This SQL branch binds five string parameters in the declared order.
        const [userSub, deviceId, secretHash, pairingId, clientId] = values as string[];

        if (devices.has(userSub)) return { rows: [], rowCount: 0 };

        const device = {
          device_id: deviceId,
          device_secret_hash: secretHash,
          pairing_id: pairingId,
          client_id: clientId,
        };

        devices.set(userSub, device);

        return { rows: [device], rowCount: 1 };
      }

      if (
        sql.includes(
          "SELECT device_id, device_secret_hash, pairing_id, client_id FROM app_paired_devices",
        )
      ) {
        // SAFETY: The SELECT branch binds the user subject as its first parameter.
        const device = devices.get(values[0] as string);

        return device ? { rows: [device], rowCount: 1 } : { rows: [], rowCount: 0 };
      }

      if (sql.includes("UPDATE app_pairing_challenges SET status = 'approved'")) {
        if (options.failApproval) throw new Error("approval write failed");
        challenge.status = "approved";

        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected transaction SQL: ${sql}`);
    },
    release() {
      releaseCount += 1;
    },
  };

  const database = Object.assign(new Pool({ connectionString: process.env.DATABASE_URL }), {
    async connect() {
      return client;
    },
    async query(sql: string, values: unknown[] = []) {
      if (sql.includes("UPDATE app_device_tickets")) {
        const ticket = [...tickets.keys()].find((value) => digest(value) === values[0]);
        const value = ticket && tickets.get(ticket);
        const device = value && devices.get(value.userSub);

        if (
          !ticket ||
          !value ||
          !device ||
          device.pairing_id !== value.pairingId ||
          consumedTickets.has(ticket)
        )
          return { rows: [], rowCount: 0 };
        consumedTickets.add(ticket);

        return {
          rows: [
            { user_sub: value.userSub, device_id: value.deviceId, pairing_id: value.pairingId },
          ],
          rowCount: 1,
        };
      }

      if (sql.includes("DELETE FROM app_paired_devices")) {
        // SAFETY: This DELETE branch binds the owner, device ID, and stored hash in order.
        const [userSub, deviceId, secretHash] = values as string[];
        const device = devices.get(userSub);

        if (!device || device.device_id !== deviceId || device.device_secret_hash !== secretHash)
          return { rows: [], rowCount: 0 };
        devices.delete(userSub);

        return { rows: [{ pairing_id: device.pairing_id }], rowCount: 1 };
      }

      if (sql.includes("DELETE FROM app_device_tickets")) {
        // SAFETY: This DELETE branch binds the user subject before the pairing ID.
        deletedTicketsPairingId = values[1] as string;

        return { rows: [], rowCount: 0 };
      }

      if (sql.includes("SELECT client_id FROM app_paired_devices")) {
        // SAFETY: This SELECT branch binds the user subject as its first parameter.
        const device = devices.get(values[0] as string);

        return device
          ? { rows: [{ client_id: device.client_id }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }

      throw new Error(`Unexpected store SQL: ${sql}`);
    },
  });

  const store = createPairingStore({ database, digest, ready: async () => undefined });
  const relay = createRoutineRelay();
  const operations = createPairingOperations(store, relay);

  return {
    challenge,
    devices,
    operations,
    relay,
    statements,
    tickets,
    consumedTickets,
    get deletedTicketsPairingId() {
      return deletedTicketsPairingId;
    },
    get releaseCount() {
      return releaseCount;
    },
  };
}

test("approval commits the pairing and binds the challenge to its account", async () => {
  const state = fixture();
  const secret = "a-secure-random-device-secret-value-123456";

  expect(
    await state.operations.approveChallenge(
      { code: "ABCD-2345", deviceId: "device-1", deviceSecret: secret },
      "user-1",
    ),
  ).toBe("approved");
  expect(state.challenge.status).toBe("approved");
  expect(state.devices.get("user-1")?.device_secret_hash).toBe(digest(secret));
  expect(
    state.statements.filter((statement) => statement === "BEGIN" || statement === "COMMIT"),
  ).toEqual(["BEGIN", "COMMIT"]);
  expect(state.releaseCount).toBe(1);
});

test("approval rolls back account mismatch and conflicting devices", async () => {
  const mismatch = fixture();
  mismatch.challenge.browserSub = "another-user";
  expect(
    await mismatch.operations.approveChallenge(
      { code: "ABCD-2345", deviceId: "device-1", deviceSecret: "secret" },
      "user-1",
    ),
  ).toBe("account_mismatch");
  expect(mismatch.statements).toContain("ROLLBACK");
  expect(mismatch.devices.size).toBe(0);

  const conflict = fixture({
    device: {
      device_id: "other-device",
      device_secret_hash: digest("other-secret"),
      pairing_id: "pairing-1",
      client_id: "client-1",
    },
  });

  expect(
    await conflict.operations.approveChallenge(
      { code: "ABCD-2345", deviceId: "device-1", deviceSecret: "secret" },
      "user-1",
    ),
  ).toBe("device_already_paired");
  expect(conflict.statements).toContain("ROLLBACK");
});

test("approval query failures roll back and propagate", async () => {
  const state = fixture({ failApproval: true });

  await expect(
    state.operations.approveChallenge(
      { code: "ABCD-2345", deviceId: "device-1", deviceSecret: "secret" },
      "user-1",
    ),
  ).rejects.toThrow("approval write failed");
  expect(state.statements).toContain("ROLLBACK");
  expect(state.releaseCount).toBe(1);
});

test("device tickets are single-use and disconnect only revokes the matching relay generation", async () => {
  const state = fixture({
    device: {
      device_id: "device-1",
      device_secret_hash: digest("secret"),
      pairing_id: "pairing-1",
      client_id: "client-1",
    },
  });

  state.tickets.set("one-time-ticket", {
    userSub: "user-1",
    deviceId: "device-1",
    pairingId: "pairing-1",
  });

  expect(await state.operations.consumeDeviceTicket("one-time-ticket")).toEqual({
    user_sub: "user-1",
    device_id: "device-1",
    pairing_id: "pairing-1",
  });
  expect(await state.operations.consumeDeviceTicket("one-time-ticket")).toBeUndefined();

  let closeCount = 0;
  await state.relay.connectPhone(
    "user-1",
    {
      id: "replacement",
      deviceId: "device-1",
      pairingId: "pairing-2",
      send: () => undefined,
      close: () => closeCount++,
    },
    async () => true,
  );
  expect(await state.operations.disconnect("user-1", "device-1", "secret")).toBe(true);
  expect(state.deletedTicketsPairingId).toBe("pairing-1");
  expect(closeCount).toBe(0);
});

test("MCP access requires the paired non-mobile client", async () => {
  const state = fixture({
    device: {
      device_id: "device-1",
      device_secret_hash: digest("secret"),
      pairing_id: "pairing-1",
      client_id: "approved-client",
    },
  });

  expect(await state.operations.canUseMcpClient("user-1", "approved-client", "mobile-client")).toBe(
    true,
  );
  expect(await state.operations.canUseMcpClient("user-1", "other-client", "mobile-client")).toBe(
    false,
  );
  expect(await state.operations.canUseMcpClient("user-1", "mobile-client", "mobile-client")).toBe(
    false,
  );
});
