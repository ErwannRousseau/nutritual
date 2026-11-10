import {
  DeleteRoutineStatus,
  ReminderOutcomes,
  isDeleteRoutineRequest,
  type DeleteRoutineRequest,
  type DeleteRoutineResult,
} from "@nutritual/protocol";
import * as storage from "./storage";
import * as relayOperations from "./operations/delete";
import { updateRoutineOperationReminder } from "./operations/shared";
import { removeReminders } from "./reminders";

type RelayCallbacks = {
  onData(data: Awaited<ReturnType<typeof storage.loadData>>): void;
  onError(message: string): void;
  onDeleted(routineId: string): void;
  serialize<T>(action: () => Promise<T>): Promise<T>;
};

export function deleteRoutineFromRelayHandler({
  onData,
  onError,
  onDeleted,
  serialize,
}: RelayCallbacks): (request: DeleteRoutineRequest) => Promise<DeleteRoutineResult> {
  const operations = new Map<string, { request: string; promise: Promise<DeleteRoutineResult> }>();

  async function deleteOnce(request: DeleteRoutineRequest): Promise<DeleteRoutineResult> {
    const input: unknown = request;

    let committed:
      | {
          status: typeof DeleteRoutineStatus.deleted | typeof DeleteRoutineStatus.alreadyProcessed;
          routineId: string;
        }
      | undefined;

    if (!isDeleteRoutineRequest(input)) {
      return {
        status: DeleteRoutineStatus.invalid,
        operationId: request.operationId,
        message: "Choose a valid routine to delete.",
      };
    }

    try {
      const operation = await relayOperations.deleteRoutineOperation(request);

      if (
        operation.status === DeleteRoutineStatus.deleted ||
        operation.status === DeleteRoutineStatus.alreadyProcessed
      ) {
        committed = operation;
      }

      if (operation.status === DeleteRoutineStatus.conflict) {
        return {
          status: DeleteRoutineStatus.conflict,
          operationId: request.operationId,
          message: "The routine changed or this operation ID has already been used.",
        };
      }

      if (operation.status === DeleteRoutineStatus.notFound) {
        return {
          status: DeleteRoutineStatus.notFound,
          operationId: request.operationId,
          message: "The routine no longer exists on this phone.",
        };
      }

      let reminder =
        operation.status === DeleteRoutineStatus.alreadyProcessed
          ? operation.reminder
          : ReminderOutcomes.unconfirmed;

      if (
        operation.status === DeleteRoutineStatus.deleted ||
        reminder === ReminderOutcomes.failed ||
        reminder === ReminderOutcomes.unconfirmed
      ) {
        try {
          await removeReminders(operation.routineId);
          reminder = ReminderOutcomes.none;
        } catch {
          reminder = ReminderOutcomes.failed;
        }

        try {
          await updateRoutineOperationReminder(request.operationId, reminder);
        } catch {
          reminder = ReminderOutcomes.unconfirmed;
        }
      }

      if (operation.status === DeleteRoutineStatus.deleted) {
        try {
          onDeleted(operation.routineId);
        } catch {
          // The saved deletion result is independent of UI state updates.
        }
      }

      try {
        onData(await storage.loadData());
      } catch {
        onError("Unable to read data on this phone. Try again.");
      }

      return {
        status: operation.status,
        operationId: request.operationId,
        routineId: operation.routineId,
        reminder,
      };
    } catch {
      if (committed) {
        return {
          status: committed.status,
          operationId: request.operationId,
          routineId: committed.routineId,
          reminder: ReminderOutcomes.unconfirmed,
        };
      }

      return {
        status: DeleteRoutineStatus.failed,
        operationId: request.operationId,
        message: "Unable to delete the routine on this phone.",
      };
    }
  }

  return (request) => {
    const requestJson = JSON.stringify({ expected: request.expected });
    const existing = operations.get(request.operationId);

    if (existing) {
      if (existing.request !== requestJson) {
        return Promise.resolve({
          status: DeleteRoutineStatus.conflict,
          operationId: request.operationId,
          message: "This ID has already been used for another routine deletion.",
        });
      }

      return existing.promise.then((result) =>
        result.status === DeleteRoutineStatus.deleted
          ? { ...result, status: DeleteRoutineStatus.alreadyProcessed }
          : result,
      );
    }

    const promise = serialize(() => deleteOnce(request)).finally(() => {
      if (operations.get(request.operationId)?.promise === promise)
        operations.delete(request.operationId);
    });

    operations.set(request.operationId, { request: requestJson, promise });

    return promise;
  };
}
