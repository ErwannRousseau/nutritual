import {
  CreateRoutineStatus,
  FrequencyKind,
  type CreateRoutineRequest,
  type ReminderOutcome,
} from "@nutritual/protocol";
import type { Routine } from "../model";
import { getDatabase } from "../database";
import { routineValues, saveRoutineDetails } from "../storage";
import { parseReminderOutcome, type RoutineOperationRow } from "./shared";

export function createRoutineRequestJson(request: CreateRoutineRequest): string {
  const { frequency } = request;
  let frequencyJson: CreateRoutineRequest["frequency"];

  switch (frequency.kind) {
    case FrequencyKind.weekdays:
      frequencyJson = { kind: FrequencyKind.weekdays, days: frequency.days };
      break;
    case FrequencyKind.interval:
      frequencyJson = {
        kind: FrequencyKind.interval,
        every: frequency.every,
        startDate: frequency.startDate,
      };
      break;
    case FrequencyKind.asNeeded:
      frequencyJson = { kind: FrequencyKind.asNeeded };
      break;
  }

  return JSON.stringify({
    productName: request.productName,
    frequency: frequencyJson,
    time: request.time,
    form: request.form,
    quantity: request.quantity && { amount: request.quantity.amount, unit: request.quantity.unit },
  });
}

export type RoutineOperationResult =
  | { status: typeof CreateRoutineStatus.created; routine: Routine }
  | {
      status: typeof CreateRoutineStatus.alreadyProcessed;
      routineId: string;
      reminder: ReminderOutcome;
    }
  | { status: typeof CreateRoutineStatus.conflict };

export async function createRoutineOperation(
  request: CreateRoutineRequest,
  routine: Routine,
): Promise<RoutineOperationResult> {
  const database = await getDatabase();
  const requestJson = createRoutineRequestJson(request);
  let result: RoutineOperationResult = { status: CreateRoutineStatus.conflict };

  await database.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<RoutineOperationRow>(
      "SELECT request_json, routine_id, reminder_outcome FROM routine_operations WHERE operation_id = ?",
      request.operationId,
    );

    if (existing) {
      result =
        existing.request_json === requestJson
          ? {
              status: CreateRoutineStatus.alreadyProcessed,
              routineId: existing.routine_id,
              reminder: parseReminderOutcome(existing.reminder_outcome),
            }
          : { status: CreateRoutineStatus.conflict };

      return;
    }

    await transaction.runAsync(
      "INSERT INTO routines (id, product_name, frequency_kind, weekday_mask, interval_days, start_date, time, paused) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      routineValues(routine),
    );
    await saveRoutineDetails(transaction, routine);
    await transaction.runAsync(
      "INSERT INTO routine_operations (operation_id, request_json, routine_id, reminder_outcome) VALUES (?, ?, ?, NULL)",
      [request.operationId, requestJson, routine.id],
    );

    result = { status: CreateRoutineStatus.created, routine };
  });

  return result;
}
