import type { ReminderState, Routine } from "@/features/routines/model";
import type { Frequency } from "@nutritual/protocol";
import { FrequencyKind, ReminderOutcomes } from "@nutritual/protocol";
import { describeFrequency } from "@/features/routines/model";

export function dateLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function frequencyLabel(frequency: Frequency): string {
  if (frequency.kind !== FrequencyKind.interval) return describeFrequency(frequency);

  const [year, month, day] = frequency.startDate.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);

  const start = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `Every ${frequency.every} days, starting ${start}`;
}

export type RoutineScheduleDisplay = { label: string; time: string | null };

export function routineScheduleDisplay(routine: Routine): RoutineScheduleDisplay {
  const frequency = frequencyLabel(routine.frequency);

  if (routine.frequency.kind === FrequencyKind.asNeeded) {
    return { label: frequency, time: null };
  }

  const time = timeLabel(new Date(`2000-01-01T${routine.time}:00`));

  return { label: `${time} · ${frequency}`, time };
}

export function reminderLabel(reminder?: ReminderState): string {
  if (!reminder) return "Checking reminder…";

  if (reminder.message) return reminder.message;

  switch (reminder.status) {
    case ReminderOutcomes.scheduled:
      return "Reminder scheduled";
    case ReminderOutcomes.denied:
      return "Notifications are disabled. The routine is saved.";
    case ReminderOutcomes.failed:
      return "Routine saved. The reminder could not be scheduled.";
    case "paused":
      return "Reminders paused";
    case ReminderOutcomes.none:
      return "No automatic reminders";
  }
}
