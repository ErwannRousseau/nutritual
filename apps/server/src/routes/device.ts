import { upgradeWebSocket } from "@hono/bun";
import { isCreateRoutineResultMessage } from "@nutritual/protocol";
import type { Hono } from "hono";
import type { McpAuthVariables } from "@neon/oauth/mcp/hono";
import type { DeviceConnection, RoutineRelay } from "../routine-relay.ts";
import type { PairingOperations } from "../pairing-operations.ts";

export function registerDeviceRoutes(
  app: Hono<McpAuthVariables>,
  relay: RoutineRelay,
  operations: PairingOperations,
): void {
  app.get("/device", async (c) => {
    const ticket = c.req.query("ticket");

    if (!ticket) return c.text("A device ticket is required.", 401);

    const identity = await operations.consumeDeviceTicket(ticket);

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
          return operations.isPairingActive(userId, deviceId, pairingId);
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
