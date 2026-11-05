import {
  CreateRoutineStatus,
  isCreateRoutineCommandMessage,
  isEditRoutineCommandMessage,
  isListRoutinesCommandMessage,
  type CreateRoutineRequest,
  type CreateRoutineResult,
  type CreateRoutineResultMessage,
  EditRoutineStatus,
  type EditRoutineRequest,
  type EditRoutineResult,
  type EditRoutineResultMessage,
} from "@nutritual/protocol";
import { getDeviceCredentials } from "@/features/auth/device-credentials";
import { phoneRequest } from "@/features/auth/phone-api";
import { phoneResponses } from "@/features/auth/phone-responses";
import { listRoutinesFromRelay } from "@/features/routines/list-routines-from-relay";
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
        let message: unknown;

        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (isListRoutinesCommandMessage(message)) {
          void listRoutinesFromRelay().then((result) => {
            if (disposed || nextSocket.readyState !== WebSocket.OPEN) return;

            try {
              nextSocket.send(
                JSON.stringify({
                  type: "list_routines_result",
                  requestId: message.requestId,
                  result,
                }),
              );
            } catch {
              // The server reports a missing response.
            }
          });

          return;
        }

        if (isEditRoutineCommandMessage(message)) {
          const sendEditResult = (result: EditRoutineResult) => {
            if (disposed || nextSocket.readyState !== WebSocket.OPEN) return;

            const response: EditRoutineResultMessage = {
              type: "edit_routine_result",
              requestId: message.requestId,
              result,
            };

            try {
              nextSocket.send(JSON.stringify(response));
            } catch {
              /* Unacknowledged operations remain retryable server-side. */
            }
          };

          void editRoutine(message.command)
            .then(sendEditResult)
            .catch(() =>
              sendEditResult({
                status: EditRoutineStatus.failed,
                operationId: message.command.operationId,
                message: "Unable to save the routine on this phone.",
              }),
            );

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
              message: "Unable to save the routine on this phone.",
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
