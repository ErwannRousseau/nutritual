import { upgradeWebSocket } from "@hono/bun";
import { isCreateRoutineResultMessage } from "@nutritual/protocol";
import type { Hono } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";
import type { DeviceConnection, RoutineRelay } from "../routine-relay.ts";
import { database, digest, ready } from "../pairing-store.ts";

type DeviceRouteDependencies = {
  database: typeof database;
  digest: typeof digest;
  ready: typeof ready;
};

const defaultDependencies: DeviceRouteDependencies = { database, digest, ready };

const ticketLifetimeMs = 60_000;

export function registerDeviceRoutes(
  app: Hono<McpAuthVariables>,
  relay: RoutineRelay,
  dependencies = defaultDependencies,
): void {
  const { database, digest, ready } = dependencies;
  app.get("/device", async (c) => {
    const ticket = c.req.query("ticket");

    if (!ticket) return c.text("A device ticket is required.", 401);

    await ready();

    const consumed = await database.query<{
      user_sub: string;
      device_id: string;
      pairing_id: string;
    }>(
      `UPDATE app_device_tickets AS ticket SET consumed_at = now()
       WHERE ticket.ticket_hash = $1 AND ticket.expires_at > now() AND ticket.consumed_at IS NULL
       AND EXISTS (SELECT 1 FROM app_paired_devices AS device
         WHERE device.user_sub = ticket.user_sub AND device.device_id = ticket.device_id
         AND device.pairing_id = ticket.pairing_id)
       RETURNING ticket.user_sub, ticket.device_id, ticket.pairing_id`,
      [digest(ticket)],
    );

    const identity = consumed.rows[0];

    if (!identity) return c.text("The device ticket is invalid or expired.", 401);

    const deviceId = identity.device_id;
    const userId = identity.user_sub;
    const pairingId = identity.pairing_id;
    const connectionId = crypto.randomUUID();

    return upgradeWebSocket(c, {
      async onOpen(_event, ws) {
        const phone: DeviceConnection = {
          id: connectionId,
          deviceId,
          pairingId,
          send: (message) => ws.send(message),
          close: (code, reason) => ws.close(code, reason),
        };

        await relay.connectPhone(userId, phone, async () => {
          await ready();

          const stillPaired = await database.query(
            `SELECT 1 FROM app_paired_devices WHERE user_sub = $1 AND device_id = $2 AND pairing_id = $3`,
            [userId, deviceId, pairingId],
          );

          return Boolean(stillPaired.rowCount);
        });
      },
      onMessage(event) {
        let value: unknown;

        try {
          value = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (isCreateRoutineResultMessage(value))
          relay.receivePhoneResult(userId, connectionId, value);
      },
      onClose() {
        relay.disconnectPhone(userId, connectionId);
      },
      onError() {
        relay.disconnectPhone(userId, connectionId);
      },
    });
  });
}

export { ticketLifetimeMs };
