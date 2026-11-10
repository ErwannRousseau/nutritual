import type {
  CreateRoutineRequest,
  CreateRoutineResult,
  EditRoutineRequest,
  EditRoutineResult,
} from "@nutritual/protocol";
import { getDeviceCredentials } from "@/features/auth/device-credentials";
import { phoneRequest } from "@/features/auth/phone-api";
import { phoneResponses } from "@/features/auth/phone-responses";
import { handleRelayMessage } from "@/features/routines/relay-messages";
import { deviceWebSocketUrl } from "@/features/auth/relay-url";
import { EXPO_PUBLIC_SERVER_URL } from "@/env";

export function connectToDeviceRelay(
  createRoutine: (request: CreateRoutineRequest) => Promise<CreateRoutineResult>,
  editRoutine: (request: EditRoutineRequest) => Promise<EditRoutineResult>,
): () => void {
  let disposed = false;
  let retryDelay = 1_000;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let socket: WebSocket | undefined;

  function scheduleReconnect() {
    if (disposed || retryTimer !== undefined) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      connect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30_000);
  }

  async function connect() {
    try {
      const device = await getDeviceCredentials();

      const { ticket } = await phoneRequest(
        "/api/phone/device-ticket",
        device,
        phoneResponses.ticket,
      );

      if (disposed) return;
      const nextSocket = new WebSocket(deviceWebSocketUrl(EXPO_PUBLIC_SERVER_URL, ticket));
      socket = nextSocket;
      nextSocket.onopen = () => {
        retryDelay = 1_000;
      };

      nextSocket.onclose = scheduleReconnect;
      nextSocket.onerror = () => nextSocket.close();
      nextSocket.onmessage = (event) => {
        handleRelayMessage(event.data, createRoutine, editRoutine, (message) => {
          if (disposed || nextSocket.readyState !== WebSocket.OPEN) return;

          try {
            nextSocket.send(JSON.stringify(message));
          } catch {
            // The server reports a missing response.
          }
        });
      };
    } catch {
      scheduleReconnect();
    }
  }

  void connect();

  return () => {
    disposed = true;

    if (retryTimer !== undefined) clearTimeout(retryTimer);

    if (socket) {
      socket.onmessage = null;
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
    }
  };
}
