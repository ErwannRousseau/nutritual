# Plan 002: Move daily overview derivation into the home feature

> **Executor instructions**: Follow this plan step by step. Run each
> verification command before moving on. Update the plan row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 5d4d727..HEAD -- apps/mobile/src/features/home apps/mobile/src/features/routines/model.ts`
> If any listed source changed, compare the current code with this plan before
> proceeding. Stop if its data or refresh behavior has materially changed.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — local-date boundaries and foreground refresh affect today's list.
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `5d4d727`, 2026-10-26

## Why this matters

`DailyOverview` owns both a clock subscription and the calculations that decide
what belongs in today's intake and upcoming routine lists. Moving the
date-sensitive selection into the home feature makes that behavior testable
without rendering the screen and leaves the component focused on displaying
the returned view data.

## Current state

- `apps/mobile/src/features/home/DailyOverview.tsx` reads routines, intakes,
  reminders, loading state, error, and reload from `useRoutineStore()`.
- It updates `now` every 60 seconds and when React Native `AppState` becomes
  `active`, then clears the interval and removes the listener on cleanup.
- It derives today's intakes by comparing `localDate(new Date(recordedAt))`
  with `localDate(now)` and sorts them newest first by ISO `recordedAt`.
- It excludes already-recorded routine IDs from the due list, uses
  `isDueOn(routine, now)`, and sorts upcoming routines by `routine.time`.
- Its as-needed section is visible when any unpaused as-needed routine exists.
- `features/routines/model.ts` exports `Routine`, `Intake`, `isDueOn`, and
  `localDate`. The state provider stays in `features/routines` per
  `apps/mobile/AGENTS.md`.

The data calculation currently reads:

```ts
const today = localDate(now);
const logged = intakes
  .filter((intake) => localDate(new Date(intake.recordedAt)) === today)
  .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
const recorded = new Set(logged.map((intake) => intake.routineId));
const upcoming = routines
  .filter((routine) => isDueOn(routine, now) && !recorded.has(routine.id))
  .sort((a, b) => a.time.localeCompare(b.time));
```

## Commands you will need

Run from the repository root:

- Typecheck: `bun run --filter mobile typecheck` — exit 0, no errors.
- Lint: `bun run --filter mobile lint` — exit 0, no errors.
- Tests: `bun run --filter mobile test` — all mobile tests pass.
- Format: `bun run fmt:check apps/mobile/src/features/home` — all home feature
  files formatted.

## Scope

**In scope**:

- `apps/mobile/src/features/home/DailyOverview.tsx`
- `apps/mobile/src/features/home/useDailyOverview.ts` (create)
- `apps/mobile/src/features/home/daily-overview.ts` (create)
- `apps/mobile/src/features/home/daily-overview.test.ts` (create)

**Out of scope**: `RoutinesProvider`, routine persistence or reminder logic,
route files, other screens, and additional test dependencies.

## Git workflow

Use the branch assigned by the operator. Follow Conventional Commit style, for
example `refactor(mobile): group screens by feature`. Do not push unless asked.

## Steps

### Step 1: Extract the pure daily view selector

Add a home-owned function that accepts routines, intakes, and a `Date`, then
returns the sorted logged list, sorted upcoming list, and whether an active
as-needed routine exists. Reuse `localDate` and `isDueOn` from the routines
feature. Do not duplicate those rules in `home` or move them to `shared`.

**Verify**: run the focused test file; the expected local-day selection and
sort order pass.

### Step 2: Move the clock lifecycle into a home hook

Add a hook that owns the `Date` state and current 60-second timer plus AppState
listener. Keep active-state refresh and cleanup behavior exactly as it is in
`DailyOverview`. Have it return `now` and the selector output based on the
current store data. The screen should retain error/loading presentation,
reminder lookup, and navigation callbacks.

**Verify**: `bun run --filter mobile typecheck` and `bun run --filter mobile lint`
both exit 0.

### Step 3: Render the hook output and run mobile checks

Replace the in-screen clock effect and derived collections with the hook
result. Keep the JSX and text selection unchanged.

**Verify**: the full mobile test, lint, typecheck, and formatting commands in
the table exit 0.

## Test plan

Add pure selector tests in `daily-overview.test.ts`, following the Bun test
style used in the mobile package. Include these cases:

- an intake on the supplied local date is included and later ISO timestamps
  sort first;
- an intake on the previous or next local date is excluded;
- a routine due today appears unless its ID has a logged intake today;
- paused and as-needed routines do not appear in upcoming;
- upcoming routines sort by `HH:mm`;
- the as-needed flag ignores paused routines and follows active ones;
- passing a date on another local day recalculates the lists.

Use dates constructed in the test's local timezone, as `localDate` and
`isDueOn` intentionally use local calendar dates. Do not add a React hook test
dependency solely for this move.

## Done criteria

- [ ] `DailyOverview` contains no clock effect or daily list derivation.
- [ ] The home hook preserves minute refresh, foreground refresh, and cleanup.
- [ ] The pure selector owns all daily list rules and has focused tests.
- [ ] Mobile lint, typecheck, tests, and home formatting pass.
- [ ] No files outside the in-scope list changed.

## STOP conditions

- Stop if the current implementation's sort, date, due, or as-needed semantics
  differ from the description.
- Stop if Expo/RN AppState ownership requires changes outside `features/home`.
- Stop if tests cannot isolate the selector without adding a dependency.

## Maintenance notes

Keep calendar logic in `features/routines/model.ts`, and keep the home-specific
combination of today's routines and intakes in `features/home`. Review the
foreground listener and interval together whenever the refresh cadence changes.
