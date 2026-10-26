# Plan 003: Move screen action flows into feature hooks

> **Executor instructions**: Follow this plan step by step. Run each
> verification command before moving on. Update the plan row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 5d4d727..HEAD -- apps/mobile/src/features/routines/screens/RoutineDetailScreen.tsx apps/mobile/src/features/routines/screens/RoutineReviewScreen.tsx apps/mobile/src/features/intakes/screens/RecordIntakeScreen.tsx apps/mobile/src/features/intakes/screens/IntakeDetailScreen.tsx apps/mobile/src/features/routines apps/mobile/src/features/intakes`
> Compare the listed screens with the excerpts below and stop on a material
> mismatch.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — keep each false result, caught error, pending guard, and navigation outcome intact.
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `5d4d727`, 2026-10-26

## Why this matters

Four screens combine presentation with multi-step asynchronous operations and
local pending/error state. Feature hooks can own those action flows so each
screen reads as data selection plus layout, while preserving the existing
storage provider and visible feedback.

## Current state

- `features/routines/screens/RoutineDetailScreen.tsx` has local feedback plus
  pause and delete handlers. Pause and removal use the store methods and show
  distinct failure messages. Successful deletion calls `router.back()`.
- `features/routines/screens/RoutineReviewScreen.tsx` validates a draft, saves
  it through the store, chooses a failure message, and calls draft `finish()`
  when saving succeeds. It also displays the provider's `busy` and `storeError`.
- `features/intakes/screens/RecordIntakeScreen.tsx` owns selected, saving, and
  feedback state. It records only when a routine exists, the intake is
  selected, and store/local busy flags allow it. On success it navigates back.
- `features/intakes/screens/IntakeDetailScreen.tsx` owns undo pending and
  feedback state; successful undo navigates back.
- `features/routines/useRoutines.ts` and `RoutinesProvider.tsx` remain the
  existing persistence/state boundary. Screen hooks must consume that API, not
  bypass storage.
- Home code continues to import reusable domain actions from their owning
  feature. Keep the four screen hooks in `features/routines` or
  `features/intakes` according to ownership.

Example of the detail action flow:

```ts
async function togglePause() {
  if (!routine || busy) return;
  setFeedback(null);
  try {
    if (!(await pause(routine.id))) {
      setFeedback("Impossible de modifier la routine. Réessayez.");
    }
  } catch {
    setFeedback("Impossible de modifier la routine. Réessayez.");
  }
}
```

The other three screens have analogous `try/catch/finally` action blocks with
their own validation and feedback. They are not one generic action API.

## Commands you will need

Run from the repository root:

- Typecheck: `bun run --filter mobile typecheck` — exit 0, no errors.
- Lint: `bun run --filter mobile lint` — exit 0, no errors.
- Tests: `bun run --filter mobile test` — all mobile tests pass.
- Format: `bun run fmt:check apps/mobile/src/features/routines
  apps/mobile/src/features/intakes` — all routine and intake files formatted.

## Scope

**In scope**:

- `apps/mobile/src/features/routines/screens/RoutineDetailScreen.tsx`
- `apps/mobile/src/features/routines/screens/RoutineReviewScreen.tsx`
- `apps/mobile/src/features/routines/useRoutineDetailActions.ts` (create)
- `apps/mobile/src/features/routines/useSaveRoutine.ts` (create)
- `apps/mobile/src/features/routines/routine-actions.test.ts` (create)
- `apps/mobile/src/features/intakes/screens/RecordIntakeScreen.tsx`
- `apps/mobile/src/features/intakes/screens/IntakeDetailScreen.tsx`
- `apps/mobile/src/features/intakes/useRecordIntake.ts` (create)
- `apps/mobile/src/features/intakes/useUndoIntake.ts` (create)
- `apps/mobile/src/features/intakes/intake-actions.test.ts` (create)

**Out of scope**: provider/persistence implementation, auth, routine scheduling
handlers that only update the current draft, UI copy redesign, and generic
async hooks shared across unrelated features.

## Git workflow

Use the branch assigned by the operator. Follow Conventional Commit style, for
example `refactor(mobile): group screens by feature`. Do not push unless asked.

## Steps

### Step 1: Extract routine detail and save flows

Add focused hooks for the routine detail actions and review save action. Each
hook owns its local feedback and pending state and calls `useRoutineStore()`.
The save hook also uses `useRoutineDraft()` for the draft and `finish()`, or
accepts those values explicitly if that yields a smaller, clearer interface.
Keep the delete confirmation dialog and its wording in `RoutineDetailScreen`;
the screen invokes the extracted deletion action from its alert callback.

**Verify**: focused routine action tests cover pause success, pause false or
rejection, delete success or failure, save validation, save false or rejection,
and pending state reset.

### Step 2: Extract intake record and undo flows

Add focused hooks under `features/intakes`. They consume the existing routine
store methods, own their pending/feedback state, and preserve the current
guards and back navigation. Keep selection toggling in `RecordIntakeScreen`
because it is local presentation state. Do not change the recorded intake
shape or storage calls.

**Verify**: focused intake action tests cover unselected/disabled recording,
successful recording, false/rejected operations, successful undo, and pending
state reset.

### Step 3: Reduce screen bodies and verify the package

Replace the in-component async handlers with the hooks' returned state and
callbacks. Keep error text, button labels/disabled state, navigation, and alert
presentation the same. Do not move small JSX navigation callbacks into hooks.

**Verify**: run all commands from the table and inspect the diff against the
listed behaviors.

## Test plan

Mobile tests use Bun's built-in runner and current tests mostly exercise pure
TypeScript modules. Keep tests dependency-free: extract only the minimum
feature-owned operation functions needed to test results and state transitions,
then have the hooks call those functions. Do not create one generic operation
framework. If this cannot be done cleanly without a React test package, stop
and report the constraint instead of adding a dependency.

Model the focused tests after the table-driven and concurrency tests in
`apps/mobile/src/features/auth/session-concurrency.test.ts`. Assert operation
calls, false/rejected result messages, success navigation/finish callbacks,
validation guards, and pending flags clearing after settlement.

Run `bun run --filter mobile test` from the repository root.

## Done criteria

- [ ] The four screens contain no multi-step async action implementations.
- [ ] Each action hook lives in its owning feature and uses current provider APIs.
- [ ] Alert confirmation and local selection UI remain easy to follow in JSX.
- [ ] Tests cover success, false result, rejection, guards, and cleanup paths.
- [ ] Mobile lint, typecheck, tests, and formatting pass.
- [ ] No files outside the in-scope list changed.

## STOP conditions

- Stop if a provider operation is not safe to call from a feature hook or its
  return semantics differ from the current screen.
- Stop if preserving screen behavior requires changing routine/intake storage.
- Stop if meaningful tests require adding a new package or a generic abstraction.

## Maintenance notes

Keep mutation and persistence in `features/routines`; `features/intakes` owns
the intake-facing action state and consumes the provider. Review button guards
and feedback alongside their hooks whenever a store method changes.
