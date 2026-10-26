# Plan 001: Share routine schedule display data

> **Executor instructions**: Follow this plan step by step. Run each
> verification command before moving on. Update the plan row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 5d4d727..HEAD -- apps/mobile/src/features/routines/display.ts apps/mobile/src/features/routines/screens/RoutineDetailScreen.tsx apps/mobile/src/features/intakes/screens/RecordIntakeScreen.tsx apps/mobile/src/features/home/components/RoutineRow.tsx`
> If any listed source changed since this plan was written, compare the current
> code with the excerpts below. Stop if the described flow no longer matches.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — the main risk is changing schedule wording or the as-needed label.
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `5d4d727`, 2026-10-26

## Why this matters

Routine schedule wording is assembled in multiple screens, and the intake
recording screen parses its own display string to recover the time for a
heading. A routine-owned formatter can return the label and its time as
separate values, keeping one source of wording for home, routine details, and
intake recording.

## Current state

- `apps/mobile/src/features/routines/display.ts` owns `frequencyLabel`,
  `timeLabel`, `dateLabel`, and `reminderLabel`.
- `apps/mobile/src/features/routines/model.ts` exports `Routine` and
  `FrequencyKind` based frequency data. Use these existing types and labels.
- `RoutineDetailScreen.tsx` and `RecordIntakeScreen.tsx` both display a
  formatted time followed by the frequency for scheduled routines.
- `RecordIntakeScreen.tsx` then uses `schedule.split(" · ")[0]` for its
  heading. For as-needed routines it displays `frequencyLabel` and the heading
  "À la demande".
- `home/components/RoutineRow.tsx` composes the same frequency with
  `routine.time` directly. Valid routine times are canonical `HH:mm` strings.
- The root `AGENTS.md` points mobile changes to `apps/mobile/AGENTS.md`. Keep
  display/domain logic in its feature and use direct imports.

## Commands you will need

Run from the repository root:

- Typecheck: `bun run --filter mobile typecheck` — exit 0, no errors.
- Lint: `bun run --filter mobile lint` — exit 0, no errors.
- Tests: `bun run --filter mobile test` — all mobile tests pass.
- Format: `bun run fmt:check apps/mobile/src/features` — all feature files
  formatted.

## Scope

**In scope**:

- `apps/mobile/src/features/routines/display.ts`
- `apps/mobile/src/features/routines/display.test.ts` (create)
- `apps/mobile/src/features/routines/screens/RoutineDetailScreen.tsx`
- `apps/mobile/src/features/intakes/screens/RecordIntakeScreen.tsx`
- `apps/mobile/src/features/home/components/RoutineRow.tsx`

**Out of scope**: data models, storage, navigation, reminder scheduling, and
shared UI components.

## Git workflow

Use the branch assigned by the operator. Follow the observed Conventional
Commit style, for example `refactor(mobile): group screens by feature`.
Do not push unless the operator asks.

## Steps

### Step 1: Add a routine schedule display helper

In `features/routines/display.ts`, add a named helper that accepts a `Routine`
and returns the complete label plus a separate nullable formatted time. For a
scheduled routine, format the time through the existing `timeLabel` and form
the current `time · frequency` wording. For an as-needed routine, return the
existing `frequencyLabel` and no time. Do not parse a display label to recover
its parts.

**Verify**: run the focused test command in the test plan; scheduled and
as-needed cases must pass.

### Step 2: Replace each screen's composition

Update the three in-scope callers to use the shared helper. Routine details
render its label. The home row renders the same existing `HH:mm · frequency`
label. Intake recording renders the helper's label and builds its heading from
the separate time, retaining "À la demande" when time is null.

**Verify**: `bun run --filter mobile typecheck` and `bun run --filter mobile lint`
both exit 0.

### Step 3: Check the full mobile package

Run the tests and formatter commands from the table, then inspect the diff for
unchanged labels and removal of the string split.

**Verify**: all commands exit 0 and this search returns no matches:

```sh
rg -n 'schedule\.split|2000-01-01T' apps/mobile/src/features
```

## Test plan

Add `display.test.ts` using Bun's built-in test runner, matching the concise
`bun:test` style of existing files such as
`apps/mobile/src/features/auth/session.test.ts`. Cover:

- a weekday routine returns the same formatted time and frequency wording;
- an interval routine retains its interval wording;
- an as-needed routine has no time and retains "À la demande";
- canonical `HH:mm` times keep the home row's current display.

Run `bun run --filter mobile test` from the repository root. Do not add a test
dependency.

## Done criteria

- [ ] The formatter is owned by `features/routines/display.ts` and imported
      directly by all three callers.
- [ ] No in-scope component assembles a routine schedule string or splits it.
- [ ] Existing schedule wording is covered by focused tests.
- [ ] Mobile lint, typecheck, tests, and in-scope formatting pass.
- [ ] No files outside the in-scope list changed.

## STOP conditions

- Stop if valid routines can contain times other than canonical `HH:mm` or if
  an existing displayed label differs from the current state described above.
- Stop if sharing the formatter would require a dependency from
  `shared/ui` to a feature.
- Stop if the focused tests require a new package.

## Maintenance notes

When schedule wording changes, update the helper and its tests. Keep the time
as structured data so screens never need to split a human-readable label.
