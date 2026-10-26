import { isRecord } from "./guards";

export const FrequencyKind = {
  weekdays: "weekdays",
  interval: "interval",
  asNeeded: "as-needed",
} as const;

export type Frequency =
  | { kind: typeof FrequencyKind.weekdays; days: number[] }
  | { kind: typeof FrequencyKind.interval; every: number; startDate: string }
  | { kind: typeof FrequencyKind.asNeeded };

export function isFrequency(value: unknown): value is Frequency {
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
