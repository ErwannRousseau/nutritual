import { describe, expect, test } from "bun:test";
import { FrequencyKind } from "@nutritual/protocol";
import { localDate, type Intake, type Routine } from "@/features/routines/model";
import { selectDailyOverview } from "./daily-overview";

describe("selectDailyOverview", () => {
  test("includes intakes for the local day and sorts newest first", () => {
    const now = new Date(2026, 5, 15, 12);
    const earlier = atLocalTime(now, 9);
    const later = atLocalTime(now, 11);
    const previousDay = shiftLocalDay(now, -1);
    const nextDay = shiftLocalDay(now, 1);

    const { logged } = selectDailyOverview(
      [],
      [
        intake("earlier", "one", earlier),
        intake("later", "two", later),
        intake("previous", "three", previousDay),
        intake("next", "four", nextDay),
      ],
      now,
    );

    expect(logged.map(({ id }) => id)).toEqual(["later", "earlier"]);
  });

  test("excludes routines already logged today and sorts remaining due routines by time", () => {
    const now = new Date(2026, 5, 15, 12);

    const { upcoming } = selectDailyOverview(
      [
        routine("late", "18:00", weekdaysOn(now)),
        routine("logged", "07:00", weekdaysOn(now)),
        routine("early", "08:00", weekdaysOn(now)),
        routine("not-due", "06:00", weekdaysOn(shiftLocalDay(now, 1))),
      ],
      [intake("today", "logged", now)],
      now,
    );

    expect(upcoming.map(({ id }) => id)).toEqual(["early", "late"]);
  });

  test("excludes paused and as-needed routines and reports active as-needed routines", () => {
    const now = new Date(2026, 5, 15, 12);

    const { upcoming, asNeeded } = selectDailyOverview(
      [
        routine("paused", "08:00", weekdaysOn(now), true),
        routine("as-needed", "09:00", { kind: FrequencyKind.asNeeded }),
        routine("paused-as-needed", "10:00", { kind: FrequencyKind.asNeeded }, true),
      ],
      [],
      now,
    );

    expect(upcoming).toEqual([]);
    expect(asNeeded).toBe(true);

    expect(
      selectDailyOverview(
        [routine("paused-as-needed", "10:00", { kind: FrequencyKind.asNeeded }, true)],
        [],
        now,
      ).asNeeded,
    ).toBe(false);
  });

  test("recalculates today's lists for another local day", () => {
    const firstDay = new Date(2026, 5, 15, 12);
    const secondDay = shiftLocalDay(firstDay, 1);

    const dailyRoutine = routine("daily", "09:00", {
      kind: FrequencyKind.interval,
      every: 1,
      startDate: localDate(firstDay),
    });

    const firstDayRoutine = routine("first-day-only", "10:00", weekdaysOn(firstDay));
    const secondDayRoutine = routine("second-day-only", "11:00", weekdaysOn(secondDay));

    const intakes = [
      intake("first-day", "daily", atLocalTime(firstDay, 10)),
      intake("second-day", "daily", atLocalTime(secondDay, 10)),
    ];

    expect(
      selectDailyOverview(
        [dailyRoutine, firstDayRoutine, secondDayRoutine],
        intakes,
        firstDay,
      ).logged.map(({ id }) => id),
    ).toEqual(["first-day"]);
    expect(
      selectDailyOverview(
        [dailyRoutine, firstDayRoutine, secondDayRoutine],
        intakes,
        secondDay,
      ).logged.map(({ id }) => id),
    ).toEqual(["second-day"]);
    expect(
      selectDailyOverview(
        [dailyRoutine, firstDayRoutine, secondDayRoutine],
        intakes,
        firstDay,
      ).upcoming.map(({ id }) => id),
    ).toEqual(["first-day-only"]);
    expect(
      selectDailyOverview(
        [dailyRoutine, firstDayRoutine, secondDayRoutine],
        intakes,
        secondDay,
      ).upcoming.map(({ id }) => id),
    ).toEqual(["second-day-only"]);
  });
});

function routine(
  id: string,
  time: string,
  frequency: Routine["frequency"],
  paused = false,
): Routine {
  return { id, productName: id, frequency, time, paused };
}

function intake(id: string, routineId: string, recordedAt: Date): Intake {
  return { id, routineId, productName: routineId, recordedAt: recordedAt.toISOString() };
}

function weekdaysOn(date: Date): Routine["frequency"] {
  return { kind: FrequencyKind.weekdays, days: [date.getDay()] };
}

function atLocalTime(date: Date, hour: number): Date {
  const result = new Date(date);
  result.setHours(hour, 0, 0, 0);

  return result;
}

function shiftLocalDay(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);

  return result;
}
