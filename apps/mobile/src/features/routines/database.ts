import * as SQLite from "expo-sqlite";
import { FrequencyKind, ReminderOutcomes } from "@nutritual/protocol";

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync("nutritual.db")
    .then(async (database) => {
      await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS routines (
        id TEXT PRIMARY KEY NOT NULL,
        product_name TEXT NOT NULL,
        frequency_kind TEXT NOT NULL CHECK (
          frequency_kind IN (
            '${FrequencyKind.weekdays}',
            '${FrequencyKind.interval}',
            '${FrequencyKind.asNeeded}'
          )
        ),
        weekday_mask INTEGER,
        interval_days INTEGER,
        start_date TEXT,
        time TEXT NOT NULL,
        paused INTEGER NOT NULL CHECK (paused IN (0, 1)),
        CHECK (
          (
            frequency_kind = '${FrequencyKind.weekdays}' AND
            weekday_mask BETWEEN 1 AND 127 AND
            interval_days IS NULL AND
            start_date IS NULL
          ) OR
          (
            frequency_kind = '${FrequencyKind.interval}' AND
            weekday_mask IS NULL AND
            interval_days BETWEEN 1 AND 36500 AND
            start_date IS NOT NULL
          ) OR
          (
            frequency_kind = '${FrequencyKind.asNeeded}' AND
            weekday_mask IS NULL AND
            interval_days IS NULL AND
            start_date IS NULL
          )
        )
      );
      CREATE TABLE IF NOT EXISTS intakes (
        id TEXT PRIMARY KEY NOT NULL,
        routine_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS routine_details (
        routine_id TEXT PRIMARY KEY NOT NULL,
        form TEXT,
        quantity_amount REAL,
        quantity_unit TEXT,
        CHECK ((quantity_amount IS NULL) = (quantity_unit IS NULL))
      );
      CREATE TABLE IF NOT EXISTS intake_details (
        intake_id TEXT PRIMARY KEY NOT NULL,
        form TEXT,
        quantity_amount REAL CHECK (quantity_amount IS NULL OR quantity_amount > 0),
        quantity_unit TEXT,
        CHECK ((quantity_amount IS NULL) = (quantity_unit IS NULL))
      );
      CREATE TABLE IF NOT EXISTS routine_operations (
        operation_id TEXT PRIMARY KEY NOT NULL,
        request_json TEXT NOT NULL,
        routine_id TEXT NOT NULL,
        reminder_outcome TEXT CHECK (
          reminder_outcome IN (
            '${ReminderOutcomes.scheduled}',
            '${ReminderOutcomes.denied}',
            '${ReminderOutcomes.failed}',
            '${ReminderOutcomes.none}',
            '${ReminderOutcomes.unconfirmed}'
          )
        )
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
