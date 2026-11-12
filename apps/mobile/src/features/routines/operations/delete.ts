import {
  DeleteRoutineStatus,
  type DeleteRoutineRequest,
  type ListedRoutine,
} from "@nutritual/protocol";
import { getDatabase } from "../database";
import { routineFromRow, type RoutineDetailsRow, type RoutineRow } from "../storage";
import { parseReminderOutcome, type RoutineOperationRow } from "./shared";

export type DeleteRoutineOperationResult =
  | { status: typeof DeleteRoutineStatus.deleted; routineId: string }
  | {
      status: typeof DeleteRoutineStatus.alreadyProcessed;
      routineId: string;
      reminder: ReturnType<typeof parseReminderOutcome>;
    }
  | { status: typeof DeleteRoutineStatus.notFound }
  | { status: typeof DeleteRoutineStatus.conflict };

function deleteRoutineRequestJson(request: DeleteRoutineRequest): string {
  return JSON.stringify({ expected: request.expected });
}

function sameRoutine(current: ReturnType<typeof routineFromRow>, expected: ListedRoutine): boolean {
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

export async function deleteRoutineOperation(
  request: DeleteRoutineRequest,
): Promise<DeleteRoutineOperationResult> {
  const database = await getDatabase();
  const requestJson = deleteRoutineRequestJson(request);
  let result: DeleteRoutineOperationResult = { status: DeleteRoutineStatus.conflict };

  await database.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<RoutineOperationRow>(
      "SELECT request_json, routine_id, reminder_outcome FROM routine_operations WHERE operation_id = ?",
      request.operationId,
    );

    if (existing) {
      if (existing.request_json !== requestJson) return;

      result = {
        status: DeleteRoutineStatus.alreadyProcessed,
        routineId: existing.routine_id,
        reminder: parseReminderOutcome(existing.reminder_outcome),
      };

      return;
    }

    const row = await transaction.getFirstAsync<RoutineRow>(
      "SELECT * FROM routines WHERE id = ?",
      request.expected.id,
    );

    if (!row) {
      result = { status: DeleteRoutineStatus.notFound };

      return;
    }

    const details = await transaction.getFirstAsync<RoutineDetailsRow>(
      "SELECT form, quantity_amount, quantity_unit FROM routine_details WHERE routine_id = ?",
      request.expected.id,
    );

    const routine = routineFromRow(row, details);

    if (!sameRoutine(routine, request.expected)) return;

    await transaction.runAsync("DELETE FROM routines WHERE id = ?", routine.id);
    await transaction.runAsync("DELETE FROM routine_details WHERE routine_id = ?", routine.id);
    await transaction.runAsync(
      "INSERT INTO routine_operations (operation_id, request_json, routine_id, reminder_outcome) VALUES (?, ?, ?, NULL)",
      [request.operationId, requestJson, routine.id],
    );
    result = { status: DeleteRoutineStatus.deleted, routineId: routine.id };
  });

  return result;
}
