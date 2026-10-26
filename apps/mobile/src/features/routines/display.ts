import type { ReminderState } from "@/features/routines/model";
import type { Frequency } from "@nutritual/protocol";
import { FrequencyKind, ReminderOutcomes } from "@nutritual/protocol";
import { describeFrequency } from "@/features/routines/model";

export function dateLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function timeLabel(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function frequencyLabel(frequency: Frequency): string {
  if (frequency.kind !== FrequencyKind.interval) return describeFrequency(frequency);

  const [year, month, day] = frequency.startDate.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);

  const start = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `Tous les ${frequency.every} jours, depuis le ${start}`;
}

export function reminderLabel(reminder?: ReminderState): string {
  if (!reminder) return "Vérification du rappel…";

  if (reminder.message) return reminder.message;

  switch (reminder.status) {
    case ReminderOutcomes.scheduled:
      return "Rappel programmé";
    case ReminderOutcomes.denied:
      return "Notifications désactivées. La routine est enregistrée.";
    case ReminderOutcomes.failed:
      return "Routine enregistrée. Le rappel n’a pas pu être programmé.";
    case "paused":
      return "Rappels en pause";
    case ReminderOutcomes.none:
      return "Sans rappel automatique";
  }
}
