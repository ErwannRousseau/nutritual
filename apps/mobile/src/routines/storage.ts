import * as SQLite from "expo-sqlite";
import {
  createRoutineStatus,
  isReminderOutcome,
  type CreateRoutineRequest,
  type ReminderOutcome,
} from "@nutritual/protocol";
import type { Intake, Routine } from "@/routines/model";
import { validateRoutine } from "@/routines/model";

type RoutineRow = {
  id: string;
  product_name: string;
  frequency_kind: string;
  weekday_mask: number | null;
  interval_days: number | null;
  start_date: string | null;
  time: string;
  paused: number;
};

type IntakeRow = {
  id: string;
  routine_id: string;
  product_name: string;
  recorded_at: string;
};

type RoutineOperationRow = {
  request_json: string;
  routine_id: string;
  reminder_outcome: string | null;
};

export type RoutineOperationResult =
  | { status: typeof createRoutineStatus.created; routine: Routine }
  | {
      status: typeof createRoutineStatus.alreadyProcessed;
      routineId: string;
      reminder: ReminderOutcome;
    }
  | { status: typeof createRoutineStatus.conflict };

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync("nutritual.db")
    .then(async (database) => {
      await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS routines (
        id TEXT PRIMARY KEY NOT NULL,
        product_name TEXT NOT NULL,
        frequency_kind TEXT NOT NULL CHECK (frequency_kind IN ('weekdays', 'interval', 'as-needed')),
        weekday_mask INTEGER,
        interval_days INTEGER,
        start_date TEXT,
        time TEXT NOT NULL,
        paused INTEGER NOT NULL CHECK (paused IN (0, 1)),
        CHECK (
          (frequency_kind = 'weekdays' AND weekday_mask BETWEEN 1 AND 127 AND interval_days IS NULL AND start_date IS NULL) OR
          (frequency_kind = 'interval' AND weekday_mask IS NULL AND interval_days BETWEEN 1 AND 36500 AND start_date IS NOT NULL) OR
          (frequency_kind = 'as-needed' AND weekday_mask IS NULL AND interval_days IS NULL AND start_date IS NULL)
        )
      );
      CREATE TABLE IF NOT EXISTS intakes (
        id TEXT PRIMARY KEY NOT NULL,
        routine_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS routine_operations (
        operation_id TEXT PRIMARY KEY NOT NULL,
        request_json TEXT NOT NULL,
        routine_id TEXT NOT NULL,
        reminder_outcome TEXT CHECK (reminder_outcome IN ('scheduled', 'denied', 'failed', 'none', 'unconfirmed'))
      );
    `);

      return database;
    })
    .catch(() => {
      databasePromise = undefined;
      throw new Error("Unable to initialize routine storage.");
    });

  return databasePromise;
}

export function createRoutineRequestJson(request: CreateRoutineRequest): string {
  const { frequency } = request;

  const canonicalFrequency =
    frequency.kind === "weekdays"
      ? { kind: frequency.kind, days: frequency.days }
      : frequency.kind === "interval"
        ? { kind: frequency.kind, every: frequency.every, startDate: frequency.startDate }
        : { kind: frequency.kind };

  return JSON.stringify({
    productName: request.productName,
    frequency: canonicalFrequency,
    time: request.time,
  });
}

function reminderOutcome(value: string | null): ReminderOutcome {
  if (value === null) return "unconfirmed";

  if (!isReminderOutcome(value)) throw new Error("Unreadable routine operation.");

  return value;
}

function routineFromRow(row: RoutineRow): Routine {
  let frequency: Routine["frequency"];

  switch (row.frequency_kind) {
    case "weekdays": {
      const mask = row.weekday_mask;

      if (mask === null) {
        throw new Error(`Unreadable routine frequency: ${row.id}`);
      }

      frequency = {
        kind: "weekdays",
        days: [0, 1, 2, 3, 4, 5, 6].filter((day) => (mask & (1 << day)) !== 0),
      };
      break;
    }

    case "interval":
      if (row.interval_days === null || row.start_date === null) {
        throw new Error(`Unreadable routine frequency: ${row.id}`);
      }

      frequency = { kind: "interval", every: row.interval_days, startDate: row.start_date };
      break;
    case "as-needed":
      frequency = { kind: "as-needed" };
      break;
    default:
      throw new Error(`Unreadable routine frequency: ${row.id}`);
  }

  const routine: Routine = {
    id: row.id,
    productName: row.product_name,
    frequency,
    time: row.time,
    paused: row.paused === 1,
  };

  if ((row.paused !== 0 && row.paused !== 1) || validateRoutine(routine) !== null) {
    throw new Error(`Unreadable routine: ${row.id}`);
  }

  return routine;
}

function routineValues(
  routine: Routine,
): [string, string, string, number | null, number | null, string | null, string, number] {
  const error = validateRoutine(routine);

  if (error) {
    throw new Error(error);
  }

  const { frequency } = routine;

  if (frequency.kind === "weekdays") {
    return [
      routine.id,
      routine.productName,
      frequency.kind,
      frequency.days.reduce((mask, day) => mask | (1 << day), 0),
      null,
      null,
      routine.time,
      Number(routine.paused),
    ];
  }

  if (frequency.kind === "interval") {
    return [
      routine.id,
      routine.productName,
      frequency.kind,
      null,
      frequency.every,
      frequency.startDate,
      routine.time,
      Number(routine.paused),
    ];
  }

  return [
    routine.id,
    routine.productName,
    frequency.kind,
    null,
    null,
    null,
    routine.time,
    Number(routine.paused),
  ];
}

export async function loadData(): Promise<{ routines: Routine[]; intakes: Intake[] }> {
  const database = await getDatabase();

  const routineRows = await database.getAllAsync<RoutineRow>(
    "SELECT * FROM routines ORDER BY rowid",
  );

  const intakeRows = await database.getAllAsync<IntakeRow>("SELECT * FROM intakes ORDER BY rowid");

  return {
    routines: routineRows.map(routineFromRow),
    intakes: intakeRows.map((row) => ({
      id: row.id,
      routineId: row.routine_id,
      productName: row.product_name,
      recordedAt: row.recorded_at,
    })),
  };
}

export async function saveRoutine(routine: Routine): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "INSERT INTO routines (id, product_name, frequency_kind, weekday_mask, interval_days, start_date, time, paused) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET product_name = excluded.product_name, frequency_kind = excluded.frequency_kind, weekday_mask = excluded.weekday_mask, interval_days = excluded.interval_days, start_date = excluded.start_date, time = excluded.time, paused = excluded.paused",
    routineValues(routine),
  );
}

export async function createRoutineOperation(
  request: CreateRoutineRequest,
  routine: Routine,
): Promise<RoutineOperationResult> {
  const database = await getDatabase();
  const requestJson = createRoutineRequestJson(request);
  let result: RoutineOperationResult = { status: createRoutineStatus.conflict };

  await database.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<RoutineOperationRow>(
      "SELECT request_json, routine_id, reminder_outcome FROM routine_operations WHERE operation_id = ?",
      request.operationId,
    );

    if (existing) {
      result =
        existing.request_json === requestJson
          ? {
              status: createRoutineStatus.alreadyProcessed,
              routineId: existing.routine_id,
              reminder: reminderOutcome(existing.reminder_outcome),
            }
          : { status: createRoutineStatus.conflict };

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

    result = { status: createRoutineStatus.created, routine };
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

export async function deleteRoutine(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM routines WHERE id = ?", id);
}

export async function saveIntake(intake: Intake): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "INSERT INTO intakes (id, routine_id, product_name, recorded_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET routine_id = excluded.routine_id, product_name = excluded.product_name, recorded_at = excluded.recorded_at",
    [intake.id, intake.routineId, intake.productName, intake.recordedAt],
  );
}

export async function deleteIntake(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM intakes WHERE id = ?", id);
}
