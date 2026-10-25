import {
  FrequencyKind,
  ReminderOutcomes,
  isValidDateString,
  validateRoutineInput,
  type Frequency,
  type ReminderOutcome,
  type RoutineInput,
} from "@nutritual/protocol";

export type { Frequency } from "@nutritual/protocol";

export type Routine = {
  id: string;
  productName: string;
  frequency: Frequency;
  time: string;
  paused: boolean;
};

export type Intake = {
  id: string;
  routineId: string;
  productName: string;
  recordedAt: string;
};

export type ReminderState = {
  routineId: string;
  status: Exclude<ReminderOutcome, typeof ReminderOutcomes.unconfirmed> | "paused";
  message: string;
};

export type RoutineDraft = RoutineInput;

const weekdayNames = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const maxIntervalDays = 36_500;

function dayOrdinal(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month, day);

  return date.getTime() / 86_400_000;
}

function localCalendarDate(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
  const date = new Date(0);
  date.setHours(hours, minutes, 0, 0);
  date.setFullYear(year, month, day);

  return date;
}

function dateParts(value: string): [number, number, number] | null {
  if (!isValidDateString(value)) return null;
  const [year, month, day] = value.split("-").map(Number);

  return [year, month - 1, day];
}

export function localDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function validateRoutine(draft: RoutineDraft): string | null {
  return validateRoutineInput(draft);
}

export function isDueOn(routine: Routine, date: Date): boolean {
  if (routine.paused || Number.isNaN(date.getTime())) return false;
  const frequency = routine.frequency;

  if (frequency.kind === FrequencyKind.asNeeded) return false;

  if (frequency.kind === FrequencyKind.weekdays) return frequency.days.includes(date.getDay());

  const start = dateParts(frequency.startDate);

  if (
    !start ||
    !Number.isInteger(frequency.every) ||
    frequency.every < 1 ||
    frequency.every > maxIntervalDays
  )
    return false;
  const ordinal = dayOrdinal(date.getFullYear(), date.getMonth(), date.getDate());
  const startOrdinal = dayOrdinal(start[0], start[1], start[2]);

  return ordinal >= startOrdinal && (ordinal - startOrdinal) % frequency.every === 0;
}

export function nextOccurrence(routine: Routine, after: Date): Date | null {
  if (
    routine.paused ||
    Number.isNaN(after.getTime()) ||
    routine.frequency.kind === FrequencyKind.asNeeded
  )
    return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(routine.time);

  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const frequency = routine.frequency;
  const start = frequency.kind === FrequencyKind.interval ? dateParts(frequency.startDate) : null;

  if (
    frequency.kind === FrequencyKind.interval &&
    (!start ||
      !Number.isInteger(frequency.every) ||
      frequency.every < 1 ||
      frequency.every > maxIntervalDays)
  )
    return null;

  const afterDay = localCalendarDate(after.getFullYear(), after.getMonth(), after.getDate());

  if (frequency.kind === FrequencyKind.interval && start) {
    const startOrdinal = dayOrdinal(start[0], start[1], start[2]);

    const afterOrdinal = dayOrdinal(
      afterDay.getFullYear(),
      afterDay.getMonth(),
      afterDay.getDate(),
    );

    const baseOrdinal = Math.max(startOrdinal, afterOrdinal);
    const remainder = (baseOrdinal - startOrdinal) % frequency.every;
    const firstOffset = (frequency.every - remainder) % frequency.every;

    // Today can be past, followed by a date whose local time does not exist at the spring clock change.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const dayOffset = baseOrdinal - afterOrdinal + firstOffset + attempt * frequency.every;

      const day = localCalendarDate(
        afterDay.getFullYear(),
        afterDay.getMonth(),
        afterDay.getDate() + dayOffset,
      );

      const candidate = localCalendarDate(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        hours,
        minutes,
      );

      if (
        candidate.getFullYear() === day.getFullYear() &&
        candidate.getMonth() === day.getMonth() &&
        candidate.getDate() === day.getDate() &&
        candidate.getHours() === hours &&
        candidate.getMinutes() === minutes &&
        candidate > after
      )
        return candidate;
    }

    return null;
  }

  for (let offset = 0; offset < 15; offset += 1) {
    const day = localCalendarDate(
      afterDay.getFullYear(),
      afterDay.getMonth(),
      afterDay.getDate() + offset,
    );

    if (!isDueOn(routine, day)) continue;

    const candidate = localCalendarDate(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      hours,
      minutes,
    );

    if (
      candidate.getFullYear() === day.getFullYear() &&
      candidate.getMonth() === day.getMonth() &&
      candidate.getDate() === day.getDate() &&
      candidate.getHours() === hours &&
      candidate.getMinutes() === minutes &&
      candidate > after
    )
      return candidate;
  }

  return null;
}

export function describeFrequency(frequency: Frequency): string {
  if (frequency.kind === FrequencyKind.asNeeded) return "À la demande";

  if (frequency.kind === FrequencyKind.interval)
    return `Tous les ${frequency.every} jours à partir du ${frequency.startDate}`;

  if (frequency.days.length === 7) return "Tous les jours";

  return frequency.days.map((day) => weekdayNames[day]).join(", ");
}
