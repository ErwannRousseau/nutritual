import {
  CreateRoutineStatus,
  FrequencyKind,
  EditRoutineStatus,
  isReminderOutcome,
  ReminderOutcomes,
  type CreateRoutineRequest,
  type EditRoutineRequest,
  type ListedRoutine,
  type ReminderOutcome,
} from "@nutritual/protocol";
import type { Routine } from "@/features/routines/model";
import { getDatabase } from "./database";
import { routineFromRow, routineValues } from "./storage";
import type { RoutineRow } from "./storage";

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
  });
}

type RoutineOperationRow = {
  request_json: string;
  routine_id: string;
  reminder_outcome: string | null;
};

export type RoutineOperationResult =
  | { status: typeof CreateRoutineStatus.created; routine: Routine }
  | {
      status: typeof CreateRoutineStatus.alreadyProcessed;
      routineId: string;
      reminder: ReminderOutcome;
    }
  | { status: typeof CreateRoutineStatus.conflict };

export type EditRoutineOperationResult =
  | { status: typeof EditRoutineStatus.updated; routine: Routine }
  | {
      status: typeof EditRoutineStatus.alreadyProcessed;
      routineId: string;
      reminder: ReminderOutcome;
    }
  | { status: typeof EditRoutineStatus.conflict };

function parseReminderOutcome(value: string | null): ReminderOutcome {
  if (value === null) return ReminderOutcomes.unconfirmed;

  if (!isReminderOutcome(value)) throw new Error("Unreadable routine operation.");

  return value;
}

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
    await transaction.runAsync(
      "INSERT INTO routine_operations (operation_id, request_json, routine_id, reminder_outcome) VALUES (?, ?, ?, NULL)",
      [request.operationId, requestJson, routine.id],
    );

    result = { status: CreateRoutineStatus.created, routine };
  });

  return result;
}

function editRoutineRequestJson(request: EditRoutineRequest): string {
  return JSON.stringify({
    expected: request.expected,
    changes: request.changes,
  });
}

function sameRoutine(current: Routine, expected: ListedRoutine): boolean {
  return (
    current.id === expected.id &&
    current.productName === expected.productName &&
    current.time === expected.time &&
    current.paused === expected.paused &&
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
      result =
        existing.request_json === requestJson
          ? {
              status: EditRoutineStatus.alreadyProcessed,
              routineId: existing.routine_id,
              reminder: parseReminderOutcome(existing.reminder_outcome),
            }
          : { status: EditRoutineStatus.conflict };

      return;
    }

    const row = await transaction.getFirstAsync<RoutineRow>(
      "SELECT * FROM routines WHERE id = ?",
      request.expected.id,
    );

    if (!row) return;

    const current = routineFromRow(row);

    if (!sameRoutine(current, request.expected)) return;

    const routine: Routine = {
      ...current,
      ...request.changes,
      productName: (request.changes.productName ?? current.productName).trim(),
    };

    await transaction.runAsync(
      "UPDATE routines SET product_name = ?, frequency_kind = ?, weekday_mask = ?, interval_days = ?, start_date = ?, time = ?, paused = ? WHERE id = ?",
      routineValues(routine).slice(1).concat(routine.id),
    );
    await transaction.runAsync(
      "INSERT INTO routine_operations (operation_id, request_json, routine_id, reminder_outcome) VALUES (?, ?, ?, NULL)",
      [request.operationId, requestJson, routine.id],
    );

    result = { status: EditRoutineStatus.updated, routine };
  });

  return result;
}

export async function updateRoutineOperationReminder(
  operationId: string,
  reminder: ReminderOutcome,
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "UPDATE routine_operations SET reminder_outcome = ? WHERE operation_id = ?",
    [reminder, operationId],
  );
}
