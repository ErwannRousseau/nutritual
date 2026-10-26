import { randomUUID } from "expo-crypto";
import {
  CreateRoutineStatus,
  ReminderOutcomes,
  validateRoutineInput,
  type CreateRoutineRequest,
  type CreateRoutineResult,
  type ReminderOutcome,
} from "@nutritual/protocol";
import type { ReminderState, Routine } from "./model";
import * as storage from "./storage";
import { updateReminder } from "./reminders";

type RelayCallbacks = {
  onData(data: Awaited<ReturnType<typeof storage.loadData>>): void;
  onError(message: string): void;
  onReminder(reminder: ReminderState): void;
};

export function createRoutineFromRelayHandler({
  onData,
  onError,
  onReminder,
}: RelayCallbacks): (request: CreateRoutineRequest) => Promise<CreateRoutineResult> {
  const operations = new Map<
    string,
    { requestJson: string; promise: Promise<CreateRoutineResult> }
  >();

  async function createOnce(request: CreateRoutineRequest): Promise<CreateRoutineResult> {
    const validation = validateRoutineInput(request);

    if (validation) {
      return {
        status: CreateRoutineStatus.invalid,
        operationId: request.operationId,
        message: validation,
      };
    }

    const routine: Routine = {
      id: randomUUID(),
      productName: request.productName.trim(),
      frequency: request.frequency,
      time: request.time,
      paused: false,
    };

    try {
      const operation = await storage.createRoutineOperation(request, routine);

      if (operation.status === CreateRoutineStatus.conflict) {
        return {
          status: CreateRoutineStatus.conflict,
          operationId: request.operationId,
          message: "Cet identifiant a déjà été utilisé avec une autre routine.",
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

      const reminderState = await updateReminder(operation.routine, true);

      let reminder: ReminderOutcome =
        reminderState.status === "paused" ? ReminderOutcomes.failed : reminderState.status;

      try {
        await storage.updateRoutineOperationReminder(request.operationId, reminder);
      } catch {
        reminder = ReminderOutcomes.unconfirmed;
      }

      onReminder(reminderState);

      try {
        onData(await storage.loadData());
      } catch {
        onError("Impossible de lire les données sur ce téléphone. Réessayez.");
      }

      return {
        status: CreateRoutineStatus.created,
        operationId: request.operationId,
        routineId: operation.routine.id,
        reminder,
      };
    } catch {
      return {
        status: CreateRoutineStatus.failed,
        operationId: request.operationId,
        message: "Impossible d’enregistrer la routine sur ce téléphone.",
      };
    }
  }

  return (request) => {
    const requestJson = storage.createRoutineRequestJson(request);
    const existing = operations.get(request.operationId);

    if (existing) {
      if (existing.requestJson !== requestJson) {
        return Promise.resolve({
          status: CreateRoutineStatus.conflict,
          operationId: request.operationId,
          message: "Cet identifiant a déjà été utilisé avec une autre routine.",
        });
      }

      return existing.promise.then((result) =>
        result.status === CreateRoutineStatus.created
          ? { ...result, status: CreateRoutineStatus.alreadyProcessed }
          : result,
      );
    }

    const promise = createOnce(request).finally(() => {
      if (operations.get(request.operationId)?.promise === promise) {
        operations.delete(request.operationId);
      }
    });

    operations.set(request.operationId, { requestJson, promise });

    return promise;
  };
}
