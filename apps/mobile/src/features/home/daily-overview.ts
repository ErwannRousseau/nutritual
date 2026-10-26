import { FrequencyKind } from "@nutritual/protocol";
import { isDueOn, localDate, type Intake, type Routine } from "@/features/routines/model";

export function selectDailyOverview(routines: Routine[], intakes: Intake[], now: Date) {
  const today = localDate(now);

  const logged = intakes
    .filter((intake) => localDate(new Date(intake.recordedAt)) === today)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  const recorded = new Set(logged.map((intake) => intake.routineId));

  const upcoming = routines
    .filter((routine) => isDueOn(routine, now) && !recorded.has(routine.id))
    .sort((a, b) => a.time.localeCompare(b.time));

  const asNeeded = routines.some(
    (routine) => !routine.paused && routine.frequency.kind === FrequencyKind.asNeeded,
  );

  return { logged, upcoming, asNeeded };
}
