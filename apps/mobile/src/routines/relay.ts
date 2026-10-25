import {
  CreateRoutineStatus,
  isCreateRoutineCommandMessage,
  type CreateRoutineRequest,
  type CreateRoutineResult,
  type CreateRoutineResultMessage,
} from "@nutritual/protocol";

export function connectToDeviceRelay(
  serverUrl: string,
  createRoutine: (request: CreateRoutineRequest) => Promise<CreateRoutineResult>,
): () => void {
  let url: URL;

  try {
    url = new URL(serverUrl);
  } catch {
    return () => {};
  }

  if (url.protocol === "http:") url.protocol = "ws:";
  else if (url.protocol === "https:") url.protocol = "wss:";
  else return () => {};

  url.pathname = "/device";
  url.search = "";
  url.hash = "";

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

  function connect() {
    let nextSocket: WebSocket;

    try {
      nextSocket = new WebSocket(url.toString());
    } catch {
      scheduleReconnect();

      return;
    }

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
          // The server reports an unconfirmed result when the phone disconnects before this ack.
        }
      };

      void createRoutine(message.command)
        .then(sendResult)
        .catch(() => {
          sendResult({
            status: CreateRoutineStatus.failed,
            operationId: message.command.operationId,
            message: "Impossible d’enregistrer la routine sur ce téléphone.",
          });
        });
    };
  }

  connect();

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
