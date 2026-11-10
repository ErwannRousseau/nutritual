import { isReminderOutcome, ReminderOutcomes, type ReminderOutcome } from "@nutritual/protocol";
import { getDatabase } from "../database";

export type RoutineOperationRow = {
  request_json: string;
  routine_id: string;
  reminder_outcome: string | null;
};

export function parseReminderOutcome(value: string | null): ReminderOutcome {
  if (value === null) return ReminderOutcomes.unconfirmed;

  if (!isReminderOutcome(value)) throw new Error("Unreadable routine operation.");

  return value;
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
