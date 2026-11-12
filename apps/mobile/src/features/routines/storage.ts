import { FrequencyKind } from "@nutritual/protocol";
import type { SQLiteRunResult } from "expo-sqlite";
import type { Intake, Routine, SkippedOccurrence } from "@/features/routines/model";
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

export type RoutineDetailsRow = {
  form: string | null;
  quantity_amount: number | null;
  quantity_unit: string | null;
};

type RoutineSqlExecutor = {
  runAsync(source: string, params: (string | number | null)[]): Promise<SQLiteRunResult>;
  runAsync(source: string, ...params: (string | number | null)[]): Promise<SQLiteRunResult>;
};

type IntakeRow = {
  id: string;
  routine_id: string;
  product_name: string;
  recorded_at: string;
  form: string | null;
  quantity_amount: number | null;
  quantity_unit: string | null;
};

export function routineFromRow(row: RoutineRow, details?: RoutineDetailsRow | null): Routine {
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

  if (details?.form !== null && details?.form !== undefined) routine.form = details.form;

  if (details?.quantity_amount !== null && details?.quantity_amount !== undefined) {
    if (details.quantity_unit === null || details.quantity_unit === undefined)
      throw new Error(`Unreadable routine details: ${row.id}`);

    routine.quantity = { amount: details.quantity_amount, unit: details.quantity_unit };
  }

  if ((row.paused !== 0 && row.paused !== 1) || validateRoutine(routine) !== null) {
    throw new Error(`Unreadable routine: ${row.id}`);
  }

  return routine;
}

export async function saveRoutineDetails(
  executor: RoutineSqlExecutor,
  routine: Routine,
): Promise<void> {
  if (routine.form === undefined && routine.quantity === undefined) {
    await executor.runAsync("DELETE FROM routine_details WHERE routine_id = ?", routine.id);

    return;
  }

  await executor.runAsync(
    "INSERT INTO routine_details (routine_id, form, quantity_amount, quantity_unit) VALUES (?, ?, ?, ?) ON CONFLICT(routine_id) DO UPDATE SET form = excluded.form, quantity_amount = excluded.quantity_amount, quantity_unit = excluded.quantity_unit",
    [
      routine.id,
      routine.form ?? null,
      routine.quantity?.amount ?? null,
      routine.quantity?.unit ?? null,
    ],
  );
}

function routineDetails(row: RoutineRow & RoutineDetailsRow): RoutineDetailsRow {
  return {
    form: row.form,
    quantity_amount: row.quantity_amount,
    quantity_unit: row.quantity_unit,
  };
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

export async function loadData(): Promise<{
  routines: Routine[];
  intakes: Intake[];
  skippedOccurrences: SkippedOccurrence[];
}> {
  const database = await getDatabase();

  const routineRows = await database.getAllAsync<RoutineRow & RoutineDetailsRow>(
    "SELECT routines.*, routine_details.form, routine_details.quantity_amount, routine_details.quantity_unit FROM routines LEFT JOIN routine_details ON routine_details.routine_id = routines.id ORDER BY routines.rowid",
  );

  const intakeRows = await database.getAllAsync<IntakeRow>(
    "SELECT intakes.*, intake_details.form, intake_details.quantity_amount, intake_details.quantity_unit FROM intakes LEFT JOIN intake_details ON intake_details.intake_id = intakes.id ORDER BY intakes.rowid",
  );

  const skippedRows = await database.getAllAsync<{ routine_id: string; local_date: string }>(
    "SELECT routine_id, local_date FROM skipped_routines",
  );

  return {
    routines: routineRows.map((row) => routineFromRow(row, routineDetails(row))),
    skippedOccurrences: skippedRows.map((row) => ({
      routineId: row.routine_id,
      date: row.local_date,
    })),
    intakes: intakeRows.map((row) => {
      const intake: Intake = {
        id: row.id,
        routineId: row.routine_id,
        productName: row.product_name,
        recordedAt: row.recorded_at,
      };

      if (row.form !== null) intake.form = row.form;

      if (row.quantity_amount !== null && row.quantity_unit !== null) {
        intake.quantity = { amount: row.quantity_amount, unit: row.quantity_unit };
      }

      return intake;
    }),
  };
}

export async function saveRoutine(routine: Routine): Promise<void> {
  const error = validateRoutine(routine);

  if (error) throw new Error(error);

  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      "INSERT INTO routines (id, product_name, frequency_kind, weekday_mask, interval_days, start_date, time, paused) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET product_name = excluded.product_name, frequency_kind = excluded.frequency_kind, weekday_mask = excluded.weekday_mask, interval_days = excluded.interval_days, start_date = excluded.start_date, time = excluded.time, paused = excluded.paused",
      routineValues(routine),
    );
    await saveRoutineDetails(transaction, routine);
  });
}

export async function deleteRoutine(id: string): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync("DELETE FROM routine_details WHERE routine_id = ?", id);
    await transaction.runAsync("DELETE FROM skipped_routines WHERE routine_id = ?", id);
    await transaction.runAsync("DELETE FROM routines WHERE id = ?", id);
  });
}

export async function skipRoutine(id: string, date: string): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync("DELETE FROM skipped_routines WHERE local_date <> ?", date);
    await transaction.runAsync(
      "INSERT INTO skipped_routines (routine_id, local_date) VALUES (?, ?) ON CONFLICT(routine_id, local_date) DO NOTHING",
      [id, date],
    );
  });
}

export async function saveIntake(intake: Intake): Promise<void> {
  if (
    intake.quantity &&
    (!Number.isFinite(intake.quantity.amount) ||
      intake.quantity.amount <= 0 ||
      !intake.quantity.unit.trim())
  ) {
    throw new Error("Invalid intake quantity.");
  }

  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      "INSERT INTO intakes (id, routine_id, product_name, recorded_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET routine_id = excluded.routine_id, product_name = excluded.product_name, recorded_at = excluded.recorded_at",
      [intake.id, intake.routineId, intake.productName, intake.recordedAt],
    );

    if (intake.form === undefined && intake.quantity === undefined) {
      await transaction.runAsync("DELETE FROM intake_details WHERE intake_id = ?", intake.id);

      return;
    }

    await transaction.runAsync(
      "INSERT INTO intake_details (intake_id, form, quantity_amount, quantity_unit) VALUES (?, ?, ?, ?) ON CONFLICT(intake_id) DO UPDATE SET form = excluded.form, quantity_amount = excluded.quantity_amount, quantity_unit = excluded.quantity_unit",
      [
        intake.id,
        intake.form ?? null,
        intake.quantity?.amount ?? null,
        intake.quantity?.unit ?? null,
      ],
    );
  });
}

export async function deleteIntake(id: string): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync("DELETE FROM intake_details WHERE intake_id = ?", id);
    await transaction.runAsync("DELETE FROM intakes WHERE id = ?", id);
  });
}
