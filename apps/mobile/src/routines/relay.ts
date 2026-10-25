import {
  createRoutineStatus,
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

  const socket = new WebSocket(url.toString());
  let disposed = false;

  socket.onmessage = (event) => {
    let message: unknown;

    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (!isCreateRoutineCommandMessage(message)) return;

    const sendResult = (result: CreateRoutineResult) => {
      if (disposed || socket.readyState !== WebSocket.OPEN) return;

      const response: CreateRoutineResultMessage = {
        type: "create_routine_result",
        requestId: message.requestId,
        result,
      };

      try {
        socket.send(JSON.stringify(response));
      } catch {
        // The server reports an unconfirmed result when the phone disconnects before this ack.
      }
    };

    void createRoutine(message.command)
      .then(sendResult)
      .catch(() => {
        sendResult({
          status: createRoutineStatus.failed,
          operationId: message.command.operationId,
          message: "Impossible d’enregistrer la routine sur ce téléphone.",
        });
      });
  };

  return () => {
    disposed = true;
    socket.onmessage = null;
    socket.close();
  };
}
