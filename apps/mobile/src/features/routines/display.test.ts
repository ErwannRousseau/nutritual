import { expect, test } from "bun:test";
import type { Frequency } from "@nutritual/protocol";
import { FrequencyKind } from "@nutritual/protocol";
import type { Routine } from "@/features/routines/model";
import { frequencyLabel, routineScheduleDisplay } from "@/features/routines/display";

function makeRoutine(frequency: Frequency, time = "08:30"): Routine {
  return {
    id: "routine-1",
    productName: "Vitamine C",
    frequency,
    time,
    paused: false,
  };
}

test("weekday schedule keeps its formatted time and frequency", () => {
  const routine = makeRoutine({ kind: FrequencyKind.weekdays, days: [1, 3, 5] });
  const schedule = routineScheduleDisplay(routine);

  expect(schedule.time).toBe("08:30");
  expect(schedule.label).toBe(`08:30 · ${frequencyLabel(routine.frequency)}`);
});

test("interval schedule keeps its interval wording", () => {
  const routine = makeRoutine(
    { kind: FrequencyKind.interval, every: 3, startDate: "2026-10-26" },
    "09:15",
  );

  const schedule = routineScheduleDisplay(routine);

  expect(schedule.label).toBe(`09:15 · ${frequencyLabel(routine.frequency)}`);
});

test("as-needed schedule has no time and keeps its label", () => {
  const routine = makeRoutine({ kind: FrequencyKind.asNeeded });

  expect(routineScheduleDisplay(routine)).toEqual({ label: "As needed", time: null });
});

test("canonical HH:mm time keeps the home row's display", () => {
  const routine = makeRoutine({ kind: FrequencyKind.weekdays, days: [2, 4] }, "23:59");
  const schedule = routineScheduleDisplay(routine);

  expect(schedule.label).toBe(`23:59 · ${frequencyLabel(routine.frequency)}`);
});
