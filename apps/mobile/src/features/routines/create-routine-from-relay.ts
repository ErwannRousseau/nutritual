import { randomUUID } from "expo-crypto";
import {
  CreateRoutineStatus,
  ReminderOutcomes,
  type CreateRoutineRequest,
  type CreateRoutineResult,
  type ReminderOutcome,
} from "@nutritual/protocol";
import type { ReminderState, Routine } from "./model";
import { ReminderStatus } from "./model";
import * as storage from "./storage";
import * as relayOperations from "./operations/create";
import { updateRoutineOperationReminder } from "./operations/shared";
import { updateReminder } from "./reminders";

type RelayCallbacks = {
  onData(data: Awaited<ReturnType<typeof storage.loadData>>): void;
  onError(message: string): void;
  onReminder(reminder: ReminderState): void;
  serialize<T>(action: () => Promise<T>): Promise<T>;
};

export function createRoutineFromRelayHandler({
  onData,
  onError,
  onReminder,
  serialize,
}: RelayCallbacks): (request: CreateRoutineRequest) => Promise<CreateRoutineResult> {
  const operations = new Map<
    string,
    { requestJson: string; promise: Promise<CreateRoutineResult> }
  >();

  async function createOnce(request: CreateRoutineRequest): Promise<CreateRoutineResult> {
    const routine: Routine = {
      id: randomUUID(),
      productName: request.productName.trim(),
      frequency: request.frequency,
      time: request.time,
      paused: false,
    };

    if (request.form !== undefined) routine.form = request.form.trim();

    if (request.quantity !== undefined) {
      routine.quantity = { amount: request.quantity.amount, unit: request.quantity.unit.trim() };
    }

    let committedRoutine: Routine | undefined;

    try {
      const operation = await relayOperations.createRoutineOperation(request, routine);

      if (operation.status === CreateRoutineStatus.conflict) {
        return {
          status: CreateRoutineStatus.conflict,
          operationId: request.operationId,
          message: "This ID has already been used for another routine.",
        };
      }

      if (operation.status === CreateRoutineStatus.alreadyProcessed) {
        return {
          status: CreateRoutineStatus.alreadyProcessed,
          operationId: request.operationId,
          routineId: operation.routineId,
          reminder: operation.reminder,
        };
      }

      committedRoutine = operation.routine;

      const reminderState = await updateReminder(operation.routine, true);

      let reminder: ReminderOutcome =
        reminderState.status === ReminderStatus.paused
          ? ReminderOutcomes.failed
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
        status: CreateRoutineStatus.created,
        operationId: request.operationId,
        routineId: operation.routine.id,
        reminder,
      };
    } catch {
      if (committedRoutine) {
        return {
          status: CreateRoutineStatus.created,
          operationId: request.operationId,
          routineId: committedRoutine.id,
          reminder: ReminderOutcomes.unconfirmed,
        };
      }

      return {
        status: CreateRoutineStatus.failed,
        operationId: request.operationId,
        message: "Unable to save the routine on this phone.",
      };
    }
  }

  return (request) => {
    const requestJson = relayOperations.createRoutineRequestJson(request);
    const existing = operations.get(request.operationId);

    if (existing) {
      if (existing.requestJson !== requestJson) {
        return Promise.resolve({
          status: CreateRoutineStatus.conflict,
          operationId: request.operationId,
          message: "This ID has already been used for another routine.",
        });
      }

      return existing.promise.then((result) =>
        result.status === CreateRoutineStatus.created
          ? { ...result, status: CreateRoutineStatus.alreadyProcessed }
          : result,
      );
    }

    const promise = serialize(() => createOnce(request)).finally(() => {
      if (operations.get(request.operationId)?.promise === promise) {
        operations.delete(request.operationId);
      }
    });

    operations.set(request.operationId, { requestJson, promise });

    return promise;
  };
}
