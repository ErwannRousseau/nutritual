import {
  CreateRoutineStatus,
  isCreateRoutineCommandMessage,
  type CreateRoutineRequest,
  type CreateRoutineResult,
  type CreateRoutineResultMessage,
} from "@nutritual/protocol";
import { getDeviceCredentials } from "@/auth/AuthProvider";
import { phoneRequest, phoneResponses, deviceWebSocketUrl } from "@/auth/phone-api";

export function connectToDeviceRelay(
  serverUrl: string,
  createRoutine: (request: CreateRoutineRequest) => Promise<CreateRoutineResult>,
): () => void {
  try {
    new URL(serverUrl);
  } catch {
    return () => {};
  }

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
      const nextSocket = new WebSocket(deviceWebSocketUrl(serverUrl, ticket));
      socket = nextSocket;
      nextSocket.onopen = () => {
        retryDelay = 1_000;
      };

      nextSocket.onclose = scheduleReconnect;
      nextSocket.onerror = () => nextSocket.close();
      nextSocket.onmessage = (event) => {
        let message: unknown;

        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (!isCreateRoutineCommandMessage(message)) return;

        const sendResult = (result: CreateRoutineResult) => {
          if (disposed || nextSocket.readyState !== WebSocket.OPEN) return;

          const response: CreateRoutineResultMessage = {
            type: "create_routine_result",
            requestId: message.requestId,
            result,
          };

          try {
            nextSocket.send(JSON.stringify(response));
          } catch {
            /* Unacknowledged operations remain retryable server-side. */
          }
        };

        void createRoutine(message.command)
          .then(sendResult)
          .catch(() =>
            sendResult({
              status: CreateRoutineStatus.failed,
              operationId: message.command.operationId,
              message: "Impossible d’enregistrer la routine sur ce téléphone.",
            }),
          );
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
