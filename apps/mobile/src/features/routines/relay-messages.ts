import {
  CreateRoutineStatus,
  EditRoutineStatus,
  isCreateRoutineCommandMessage,
  isEditRoutineCommandMessage,
  isListRoutinesCommandMessage,
  type CreateRoutineRequest,
  type CreateRoutineResult,
  type CreateRoutineResultMessage,
  type EditRoutineRequest,
  type EditRoutineResult,
  type EditRoutineResultMessage,
  type ListRoutinesResultMessage,
} from "@nutritual/protocol";
import { listRoutinesFromRelay } from "@/features/routines/list-routines-from-relay";

export function handleRelayMessage(
  data: string,
  createRoutine: (request: CreateRoutineRequest) => Promise<CreateRoutineResult>,
  editRoutine: (request: EditRoutineRequest) => Promise<EditRoutineResult>,
  send: (
    message: CreateRoutineResultMessage | EditRoutineResultMessage | ListRoutinesResultMessage,
  ) => void,
): void {
  let message: unknown;

  try {
    message = JSON.parse(data);
  } catch {
    return;
  }

  if (isListRoutinesCommandMessage(message)) {
    void listRoutinesFromRelay().then((result) => {
      send({ type: "list_routines_result", requestId: message.requestId, result });
    });

    return;
  }

  if (isEditRoutineCommandMessage(message)) {
    const reply = (result: EditRoutineResult) => {
      send({ type: "edit_routine_result", requestId: message.requestId, result });
    };

    void editRoutine(message.command)
      .then(reply)
      .catch(() =>
        reply({
          status: EditRoutineStatus.failed,
          operationId: message.command.operationId,
          message: "Unable to save the routine on this phone.",
        }),
      );

    return;
  }

  if (!isCreateRoutineCommandMessage(message)) return;

  const reply = (result: CreateRoutineResult) => {
    send({ type: "create_routine_result", requestId: message.requestId, result });
  };

  void createRoutine(message.command)
    .then(reply)
    .catch(() =>
      reply({
        status: CreateRoutineStatus.failed,
        operationId: message.command.operationId,
        message: "Unable to save the routine on this phone.",
      }),
    );
}
