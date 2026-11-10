import {
  EditRoutineStatus,
  ReminderOutcomes,
  type EditRoutineRequest,
  type EditRoutineResult,
  type ReminderOutcome,
} from "@nutritual/protocol";
import type { ReminderState, Routine } from "./model";
import { ReminderStatus } from "./model";
import * as storage from "./storage";
import * as relayOperations from "./operations/edit";
import { updateRoutineOperationReminder } from "./operations/shared";
import { updateReminder } from "./reminders";

type RelayCallbacks = {
  onData(data: Awaited<ReturnType<typeof storage.loadData>>): void;
  onError(message: string): void;
  onReminder(reminder: ReminderState): void;
  serialize<T>(action: () => Promise<T>): Promise<T>;
};

export function editRoutineFromRelayHandler({
  onData,
  onError,
  onReminder,
  serialize,
}: RelayCallbacks): (request: EditRoutineRequest) => Promise<EditRoutineResult> {
  const operations = new Map<string, { request: string; promise: Promise<EditRoutineResult> }>();

  async function editOnce(request: EditRoutineRequest): Promise<EditRoutineResult> {
    let committedRoutine: Routine | undefined;

    try {
      const operation = await relayOperations.editRoutineOperation(request);

      if (operation.status === EditRoutineStatus.conflict) {
        return {
          status: EditRoutineStatus.conflict,
          operationId: request.operationId,
          message: "The routine changed or this operation ID has already been used.",
        };
      }

      if (operation.status === EditRoutineStatus.alreadyProcessed) {
        return {
          status: EditRoutineStatus.alreadyProcessed,
          operationId: request.operationId,
          routineId: operation.routineId,
          reminder: operation.reminder,
        };
      }

      committedRoutine = operation.routine;

      const reminderState = await updateReminder(operation.routine, !operation.routine.paused);

      let reminder: ReminderOutcome =
        reminderState.status === ReminderStatus.paused
          ? ReminderOutcomes.none
          : reminderState.status;

      try {
        await updateRoutineOperationReminder(request.operationId, reminder);
      } catch {
        reminder = ReminderOutcomes.unconfirmed;
      }

      onReminder(reminderState);

      try {
        onData(await storage.loadData());
      } catch {
        onError("Unable to read data on this phone. Try again.");
      }

      return {
        status: EditRoutineStatus.updated,
        operationId: request.operationId,
        routineId: operation.routine.id,
        reminder,
      };
    } catch {
      if (committedRoutine) {
        return {
          status: EditRoutineStatus.updated,
          operationId: request.operationId,
          routineId: committedRoutine.id,
          reminder: ReminderOutcomes.unconfirmed,
        };
      }

      return {
        status: EditRoutineStatus.failed,
        operationId: request.operationId,
        message: "Unable to save the routine on this phone.",
      };
    }
  }

  return (request) => {
    const requestJson = JSON.stringify({ expected: request.expected, changes: request.changes });
    const existing = operations.get(request.operationId);

    if (existing) {
      if (existing.request !== requestJson) {
        return Promise.resolve({
          status: EditRoutineStatus.conflict,
          operationId: request.operationId,
          message: "This ID has already been used for another routine change.",
        });
      }

      return existing.promise.then((result) =>
        result.status === EditRoutineStatus.updated
          ? { ...result, status: EditRoutineStatus.alreadyProcessed }
          : result,
      );
    }

    const promise = serialize(() => editOnce(request)).finally(() => {
      if (operations.get(request.operationId)?.promise === promise)
        operations.delete(request.operationId);
    });

    operations.set(request.operationId, { request: requestJson, promise });

    return promise;
  };
}
