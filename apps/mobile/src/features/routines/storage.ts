import { FrequencyKind } from "@nutritual/protocol";
import type { Intake, Routine } from "@/features/routines/model";
import { validateRoutine } from "@/features/routines/model";
import { getDatabase } from "./database";

export type RoutineRow = {
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

export function routineFromRow(row: RoutineRow): Routine {
  let frequency: Routine["frequency"];

  switch (row.frequency_kind) {
    case FrequencyKind.weekdays: {
      const mask = row.weekday_mask;

      if (mask === null) {
        throw new Error(`Unreadable routine frequency: ${row.id}`);
      }

      frequency = {
        kind: FrequencyKind.weekdays,
        days: [0, 1, 2, 3, 4, 5, 6].filter((day) => (mask & (1 << day)) !== 0),
      };
      break;
    }

    case FrequencyKind.interval:
      if (row.interval_days === null || row.start_date === null) {
        throw new Error(`Unreadable routine frequency: ${row.id}`);
      }

      frequency = {
        kind: FrequencyKind.interval,
        every: row.interval_days,
        startDate: row.start_date,
      };
      break;
    case FrequencyKind.asNeeded:
      frequency = { kind: FrequencyKind.asNeeded };
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

export function routineValues(
  routine: Routine,
): [string, string, string, number | null, number | null, string | null, string, number] {
  const error = validateRoutine(routine);

  if (error) {
    throw new Error(error);
  }

  const { frequency } = routine;

  if (frequency.kind === FrequencyKind.weekdays) {
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

  if (frequency.kind === FrequencyKind.interval) {
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
