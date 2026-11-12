import {
  EditRoutineStatus,
  type EditRoutineRequest,
  type ListedRoutine,
  type ReminderOutcome,
} from "@nutritual/protocol";
import type { Routine } from "../model";
import { getDatabase } from "../database";
import {
  routineFromRow,
  routineValues,
  saveRoutineDetails,
  type RoutineDetailsRow,
  type RoutineRow,
} from "../storage";
import { parseReminderOutcome, type RoutineOperationRow } from "./shared";

export type EditRoutineOperationResult =
  | { status: typeof EditRoutineStatus.updated; routine: Routine }
  | { status: typeof EditRoutineStatus.unchanged; routineId: string }
  | {
      status: typeof EditRoutineStatus.alreadyProcessed;
      routineId: string;
      reminder: ReminderOutcome;
    }
  | { status: typeof EditRoutineStatus.conflict };

function editRoutineRequestJson(request: EditRoutineRequest): string {
  return JSON.stringify({
    expected: request.expected,
    changes: request.changes,
  });
}

function isPausedOnlyEdit(request: EditRoutineRequest): boolean {
  return (
    Object.keys(request.changes).length === 1 && request.changes.paused === request.expected.paused
  );
}

function sameRoutine(current: Routine, expected: ListedRoutine): boolean {
  return (
    current.id === expected.id &&
    current.productName === expected.productName &&
    current.time === expected.time &&
    current.paused === expected.paused &&
    current.form === expected.form &&
    current.quantity?.amount === expected.quantity?.amount &&
    current.quantity?.unit === expected.quantity?.unit &&
    JSON.stringify(current.frequency) === JSON.stringify(expected.frequency)
  );
}

export async function editRoutineOperation(
  request: EditRoutineRequest,
): Promise<EditRoutineOperationResult> {
  const database = await getDatabase();
  const requestJson = editRoutineRequestJson(request);
  let result: EditRoutineOperationResult = { status: EditRoutineStatus.conflict };

  await database.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<RoutineOperationRow>(
      "SELECT request_json, routine_id, reminder_outcome FROM routine_operations WHERE operation_id = ?",
      request.operationId,
    );

    if (existing) {
      if (existing.request_json !== requestJson) return;

      if (isPausedOnlyEdit(request)) {
        result = { status: EditRoutineStatus.unchanged, routineId: existing.routine_id };
      } else {
        result = {
          status: EditRoutineStatus.alreadyProcessed,
          routineId: existing.routine_id,
          reminder: parseReminderOutcome(existing.reminder_outcome),
        };
      }

      return;
    }

    const row = await transaction.getFirstAsync<RoutineRow>(
      "SELECT * FROM routines WHERE id = ?",
      request.expected.id,
    );

    if (!row) return;

    const details = await transaction.getFirstAsync<RoutineDetailsRow>(
      "SELECT form, quantity_amount, quantity_unit FROM routine_details WHERE routine_id = ?",
      request.expected.id,
    );

    const current = routineFromRow(row, details);

    if (!sameRoutine(current, request.expected)) return;

    if (isPausedOnlyEdit(request)) {
      await transaction.runAsync(
        "INSERT INTO routine_operations (operation_id, request_json, routine_id, reminder_outcome) VALUES (?, ?, ?, NULL)",
        [request.operationId, requestJson, current.id],
      );
      result = { status: EditRoutineStatus.unchanged, routineId: current.id };

      return;
    }

    const changedQuantity = request.changes.quantity;

    const quantity = changedQuantity && {
      amount: changedQuantity.amount,
      unit: changedQuantity.unit.trim(),
    };

    const routine: Routine = {
      ...current,
      ...request.changes,
      form: request.changes.form === undefined ? current.form : request.changes.form?.trim(),
      quantity: changedQuantity === undefined ? current.quantity : (quantity ?? undefined),
      productName: (request.changes.productName ?? current.productName).trim(),
    };

    await transaction.runAsync(
      "UPDATE routines SET product_name = ?, frequency_kind = ?, weekday_mask = ?, interval_days = ?, start_date = ?, time = ?, paused = ? WHERE id = ?",
      routineValues(routine).slice(1).concat(routine.id),
    );
    await saveRoutineDetails(transaction, routine);
    await transaction.runAsync(
      "INSERT INTO routine_operations (operation_id, request_json, routine_id, reminder_outcome) VALUES (?, ?, ?, NULL)",
      [request.operationId, requestJson, routine.id],
    );

    result = { status: EditRoutineStatus.updated, routine };
  });

  return result;
}
