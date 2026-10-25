export const FrequencyKind = {
  weekdays: "weekdays",
  interval: "interval",
  asNeeded: "as-needed",
} as const;

export type Frequency =
  | { kind: typeof FrequencyKind.weekdays; days: number[] }
  | { kind: typeof FrequencyKind.interval; every: number; startDate: string }
  | { kind: typeof FrequencyKind.asNeeded };

export type RoutineInput = {
  productName: string;
  frequency: Frequency;
  time: string;
};

export type CreateRoutineRequest = RoutineInput & { operationId: string };

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

export const CreateRoutineDeliveryStatus = {
  unavailable: "unavailable",
  unconfirmed: "unconfirmed",
} as const;

export type CreateRoutineDeliveryResult =
  | CreateRoutineResult
  | { status: typeof CreateRoutineDeliveryStatus.unavailable; message: string }
  | {
      status: typeof CreateRoutineDeliveryStatus.unconfirmed;
      operationId: string;
      message: string;
    };

export type CreateRoutineCommandMessage = {
  type: "create_routine";
  requestId: string;
  command: CreateRoutineRequest;
};

export type CreateRoutineResultMessage = {
  type: "create_routine_result";
  requestId: string;
  result: CreateRoutineResult;
};

const maxIntervalDays = 36_500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFrequency(value: unknown): value is Frequency {
  if (!isRecord(value)) return false;

  switch (value.kind) {
    case FrequencyKind.weekdays:
      return Array.isArray(value.days) && value.days.every(Number.isInteger);
    case FrequencyKind.interval:
      return Number.isInteger(value.every) && typeof value.startDate === "string";
    case FrequencyKind.asNeeded:
      return true;
    default:
      return false;
  }
}

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
  if (!input.productName.trim()) return "Le nom du produit est obligatoire.";

  const frequency = input.frequency;

  if (frequency.kind !== FrequencyKind.asNeeded && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time))
    return "Choisissez une heure valide au format HH:mm.";

  if (frequency.kind === FrequencyKind.weekdays) {
    if (
      frequency.days.length === 0 ||
      frequency.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
      new Set(frequency.days).size !== frequency.days.length
    ) {
      return "Choisissez au moins un jour de la semaine, sans doublon.";
    }
  } else if (frequency.kind === FrequencyKind.interval) {
    if (
      !Number.isInteger(frequency.every) ||
      frequency.every < 1 ||
      frequency.every > maxIntervalDays
    ) {
      return `L’intervalle doit être compris entre 1 et ${maxIntervalDays} jours.`;
    }

    if (!isValidDateString(frequency.startDate)) return "Choisissez une date de début valide.";
  } else if (frequency.kind !== FrequencyKind.asNeeded) {
    return "Choisissez une fréquence valide.";
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

export function isCreateRoutineCommandMessage(
  value: unknown,
): value is CreateRoutineCommandMessage {
  return (
    isRecord(value) &&
    value.type === "create_routine" &&
    typeof value.requestId === "string" &&
    !!value.requestId &&
    isCreateRoutineRequest(value.command)
  );
}

export function isReminderOutcome(value: unknown): value is ReminderOutcome {
  return Object.values(ReminderOutcomes).some((outcome) => outcome === value);
}

function isCreateRoutineResult(value: unknown): value is CreateRoutineResult {
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

export function isCreateRoutineResultMessage(value: unknown): value is CreateRoutineResultMessage {
  return (
    isRecord(value) &&
    value.type === "create_routine_result" &&
    typeof value.requestId === "string" &&
    !!value.requestId &&
    isCreateRoutineResult(value.result)
  );
}
