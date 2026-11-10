import { FrequencyKind, isFrequency, type Frequency } from "./frequency";
import { isRecord } from "./guards";

export type RoutineInput = {
  productName: string;
  frequency: Frequency;
  time: string;
};

export type CreateRoutineRequest = RoutineInput & { operationId: string };

export type EditRoutineRequest = {
  operationId: string;
  expected: ListedRoutine;
  changes: Partial<RoutineInput> & { paused?: boolean };
};

export const CreateRoutineStatus = {
  created: "created",
  alreadyProcessed: "already_processed",
  conflict: "conflict",
  invalid: "invalid",
  failed: "failed",
} as const;

export const ReminderOutcomes = {
  scheduled: "scheduled",
  denied: "denied",
  failed: "failed",
  none: "none",
  unconfirmed: "unconfirmed",
} as const;

export type ReminderOutcome = (typeof ReminderOutcomes)[keyof typeof ReminderOutcomes];

export type CreateRoutineResult =
  | {
      status: typeof CreateRoutineStatus.created | typeof CreateRoutineStatus.alreadyProcessed;
      operationId: string;
      routineId: string;
      reminder: ReminderOutcome;
    }
  | { status: typeof CreateRoutineStatus.conflict; operationId: string; message: string }
  | {
      status: typeof CreateRoutineStatus.invalid | typeof CreateRoutineStatus.failed;
      operationId?: string;
      message: string;
    };

const maxIntervalDays = 36_500;

export function isValidDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function validateRoutineInput(input: RoutineInput): string | null {
  if (!input.productName.trim()) return "Product name is required.";

  const frequency = input.frequency;

  if (frequency.kind !== FrequencyKind.asNeeded && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time))
    return "Choose a valid time in HH:mm format.";

  if (frequency.kind === FrequencyKind.weekdays) {
    if (
      frequency.days.length === 0 ||
      frequency.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
      new Set(frequency.days).size !== frequency.days.length
    ) {
      return "Choose at least one day of the week, with no duplicates.";
    }
  } else if (frequency.kind === FrequencyKind.interval) {
    if (
      !Number.isInteger(frequency.every) ||
      frequency.every < 1 ||
      frequency.every > maxIntervalDays
    ) {
      return `The interval must be between 1 and ${maxIntervalDays} days.`;
    }

    if (!isValidDateString(frequency.startDate)) return "Choose a valid start date.";
  } else if (frequency.kind !== FrequencyKind.asNeeded) {
    return "Choose a valid frequency.";
  }

  return null;
}

export function isCreateRoutineRequest(value: unknown): value is CreateRoutineRequest {
  if (
    !isRecord(value) ||
    typeof value.operationId !== "string" ||
    !value.operationId.trim() ||
    typeof value.productName !== "string" ||
    typeof value.time !== "string" ||
    !isFrequency(value.frequency)
  ) {
    return false;
  }

  return (
    validateRoutineInput({
      productName: value.productName,
      frequency: value.frequency,
      time: value.time,
    }) === null
  );
}

export function isEditRoutineRequest(value: unknown): value is EditRoutineRequest {
  if (
    !isRecord(value) ||
    typeof value.operationId !== "string" ||
    !value.operationId.trim() ||
    !isListedRoutine(value.expected) ||
    !isRecord(value.changes)
  ) {
    return false;
  }

  const changeKeys = Object.keys(value.changes);

  if (
    changeKeys.length === 0 ||
    changeKeys.some((key) => !["productName", "frequency", "time", "paused"].includes(key))
  ) {
    return false;
  }

  const changes: Partial<RoutineInput> = {};

  if ("productName" in value.changes) {
    if (typeof value.changes.productName !== "string") return false;
    changes.productName = value.changes.productName;
  }

  if ("frequency" in value.changes) {
    if (!isFrequency(value.changes.frequency)) return false;
    changes.frequency = value.changes.frequency;
  }

  if ("time" in value.changes) {
    if (typeof value.changes.time !== "string") return false;
    changes.time = value.changes.time;
  }

  if ("paused" in value.changes && typeof value.changes.paused !== "boolean") return false;

  const merged = {
    operationId: value.operationId,
    productName: changes.productName ?? value.expected.productName,
    frequency: changes.frequency ?? value.expected.frequency,
    time: changes.time ?? value.expected.time,
  } satisfies CreateRoutineRequest;

  return validateRoutineInput(merged) === null;
}

export function isReminderOutcome(value: unknown): value is ReminderOutcome {
  return Object.values(ReminderOutcomes).some((outcome) => outcome === value);
}

export function isCreateRoutineResult(value: unknown): value is CreateRoutineResult {
  if (!isRecord(value)) return false;

  if (
    value.status === CreateRoutineStatus.created ||
    value.status === CreateRoutineStatus.alreadyProcessed
  ) {
    return (
      typeof value.operationId === "string" &&
      typeof value.routineId === "string" &&
      isReminderOutcome(value.reminder)
    );
  }

  if (value.status === CreateRoutineStatus.conflict) {
    return typeof value.operationId === "string" && typeof value.message === "string";
  }

  if (value.status === CreateRoutineStatus.invalid || value.status === CreateRoutineStatus.failed) {
    return (
      (value.operationId === undefined || typeof value.operationId === "string") &&
      typeof value.message === "string"
    );
  }

  return false;
}

export type ListedRoutine = RoutineInput & { id: string; paused: boolean };

function isListedRoutine(value: unknown): value is ListedRoutine {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.productName !== "string" ||
    typeof value.time !== "string" ||
    typeof value.paused !== "boolean" ||
    !isFrequency(value.frequency)
  ) {
    return false;
  }

  return (
    validateRoutineInput({
      productName: value.productName,
      frequency: value.frequency,
      time: value.time,
    }) === null
  );
}

export const ListRoutinesStatus = {
  ok: "ok",
  failed: "failed",
  unavailable: "unavailable",
} as const;

export type ListRoutinesResult =
  | { status: typeof ListRoutinesStatus.ok; routines: ListedRoutine[] }
  | { status: typeof ListRoutinesStatus.failed; message: string };

export const EditRoutineStatus = {
  updated: "updated",
  alreadyProcessed: "already_processed",
  unchanged: "unchanged",
  conflict: "conflict",
  invalid: "invalid",
  failed: "failed",
} as const;

export type EditRoutineResult =
  | {
      status:
        | typeof EditRoutineStatus.updated
        | typeof EditRoutineStatus.alreadyProcessed
        | typeof EditRoutineStatus.unchanged;
      operationId: string;
      routineId: string;
      reminder: ReminderOutcome;
    }
  | { status: typeof EditRoutineStatus.conflict; operationId: string; message: string }
  | {
      status: typeof EditRoutineStatus.invalid | typeof EditRoutineStatus.failed;
      operationId: string;
      message: string;
    };

export function isEditRoutineResult(value: unknown): value is EditRoutineResult {
  if (!isRecord(value) || typeof value.operationId !== "string") return false;

  if (
    value.status === EditRoutineStatus.updated ||
    value.status === EditRoutineStatus.alreadyProcessed ||
    value.status === EditRoutineStatus.unchanged
  ) {
    return (
      typeof value.routineId === "string" && !!value.routineId && isReminderOutcome(value.reminder)
    );
  }

  return (
    (value.status === EditRoutineStatus.conflict ||
      value.status === EditRoutineStatus.invalid ||
      value.status === EditRoutineStatus.failed) &&
    typeof value.message === "string"
  );
}

export function isListRoutinesResult(value: unknown): value is ListRoutinesResult {
  if (!isRecord(value)) return false;

  if (value.status === ListRoutinesStatus.failed) return typeof value.message === "string";

  return (
    value.status === ListRoutinesStatus.ok &&
    Array.isArray(value.routines) &&
    value.routines.every(isListedRoutine)
  );
}
