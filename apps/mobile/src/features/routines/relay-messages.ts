import {
  CreateRoutineStatus,
  DeleteRoutineStatus,
  EditRoutineStatus,
  isCreateRoutineCommandMessage,
  isDeleteRoutineCommandMessage,
  isEditRoutineCommandMessage,
  isListRoutinesCommandMessage,
  type CreateRoutineRequest,
  type CreateRoutineResult,
  type CreateRoutineResultMessage,
  type DeleteRoutineRequest,
  type DeleteRoutineResult,
  type DeleteRoutineResultMessage,
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
  deleteRoutine: (request: DeleteRoutineRequest) => Promise<DeleteRoutineResult>,
  send: (
    message:
      | CreateRoutineResultMessage
      | DeleteRoutineResultMessage
      | EditRoutineResultMessage
      | ListRoutinesResultMessage,
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

  if (isDeleteRoutineCommandMessage(message)) {
    const reply = (result: DeleteRoutineResult) => {
      send({ type: "delete_routine_result", requestId: message.requestId, result });
    };

    void deleteRoutine(message.command)
      .then(reply)
      .catch(() =>
        reply({
          status: DeleteRoutineStatus.failed,
          operationId: message.command.operationId,
          message: "Unable to delete the routine on this phone.",
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
