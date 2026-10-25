import { upgradeWebSocket } from "@hono/bun";
import { isCreateRoutineResultMessage } from "@nutritual/protocol";
import type { Hono } from "hono";
import type { DeviceConnection, RoutineRelay } from "../routine-relay.ts";

export function registerDeviceRoutes(app: Hono, relay: RoutineRelay): void {
  app.get(
    "/device",
    upgradeWebSocket(() => {
      const phoneId = crypto.randomUUID();

      return {
        onOpen(_event, ws) {
          const phone: DeviceConnection = {
            id: phoneId,
            send: (message) => ws.send(message),
            close: (code, reason) => ws.close(code, reason),
          };

          relay.connectPhone(phone);
        },
        onMessage(event) {
          let value: unknown;

          try {
            value = JSON.parse(String(event.data));
          } catch {
            return;
          }

          if (isCreateRoutineResultMessage(value)) relay.receivePhoneResult(phoneId, value);
        },
        onClose() {
          relay.disconnectPhone(phoneId);
        },
        onError() {
          relay.disconnectPhone(phoneId);
        },
      };
    }),
  );
}
