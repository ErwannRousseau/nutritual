# Plan 001: Group mobile code by feature and remove the UI barrel

> **Executor instructions**: Follow this plan step by step. Preserve all existing
> behavior and route paths. Run every verification command and confirm the
> expected result before moving on. If a STOP condition occurs, stop and report
> it without improvising.
>
> **Drift check (run first)**: Run
> `git diff --stat 1af7558..HEAD -- apps/mobile/src` and
> `git status --short -- apps/mobile/src`. The mobile source state this plan
> was written against is now committed as `1af7558` (`feat: add routine
> history and improve intake tracking`). Start the executor worktree from that
> commit or a later reviewed state.

## Status

- **Priority**: P2
- **Effort**: M (about 4–6 hours)
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `1af7558`, 2026-10-25

## Why this matters

The mobile app separates route screens, routine behavior, and feature
components across `src/app`, `src/routines`, and
`src/components/{overview,routine-detail,routine-form}`. That forces a reader to
cross technical folders to understand one user flow. Group the implementation
under the approved `features/home`, `features/routines`, and
`features/intakes` folders, with reusable UI under `shared/ui`. Keep Expo route
files and URL paths unchanged, and remove the single UI barrel so imports name
their owning module.

## Current state

- `apps/mobile/src/app` is the Expo Router tree. `apps/mobile/AGENTS.md:26-30`
  says routes live there and non-route code stays outside it.
- `apps/mobile/src/app/index.tsx:1-5` is a route adapter already. It imports
  `DailyOverview` from `@/components/overview/DailyOverview` and renders it.
- `apps/mobile/src/app/_layout.tsx:25-40` declares the existing route names.
  In particular, `routine-detail/[id]` is a route path. It is also referenced
  by the home screen and routine draft flow. Keep this path and all other route
  filenames unchanged.
- `apps/mobile/src/routines` contains `RoutinesProvider`, `useRoutines`,
  `model`, `storage`, `reminders`, and `display`. Keep this data and behavior
  together under `features/routines`. Intake rows and routines currently share
  the same local store, so this plan does not split that store.
- `apps/mobile/src/components/overview` contains the home screen and its
  home-only routine/intake rows. Put these under `features/home`.
- `UpcomingCard` is shared by the home screen and the as-needed route, and it
  renders a `Routine`. Put it under `features/routines/components` so routines
  does not depend on home.
- `apps/mobile/src/components/routine-detail` and `routine-form` contain
  routine-only UI and draft state. Put them under `features/routines`.
- `apps/mobile/src/app/history.tsx`, `intake/[id].tsx`, and `record/[id].tsx`
  implement intake-history and intake-recording screens. Put their screen
  implementations under `features/intakes/screens`. Keep the matching route
  files as small adapters.
- `apps/mobile/src/components/ui/index.ts:1-31` is the only barrel found in
  mobile source. Eight modules import through it: six route screens,
  `ActionRow`, and `ChoiceRow`. Replace these with direct imports and delete
  the barrel. The `index.tsx` files under `src/app` are actual route screens
  and must remain.
- `apps/mobile/src/components/ui/ActionButton.tsx` and
  `ActionButton.ios.tsx` are a platform-specific pair. The same applies to
  `SheetHeader.tsx` and `SheetHeader.ios.tsx`. Move each pair together and keep
  the filenames.
- Use the existing `@/…` import style. Do not add a package or create new
  re-export files.

The names follow the domain terms in `GLOSSARY.md:10-17`. An intake routine is
the schedule and an intake is the recorded occurrence. The layout also follows
`docs/adr/0005-use-expo-ui-for-the-ios-routine-milestone.md:9-23`, which keeps
routine rules, persistence, and reminders separate from UI while reusing the
universal UI components.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Mobile lint | `bun run --filter mobile lint` | Exit 0 |
| Mobile typecheck | `bun run --filter mobile typecheck` | Exit 0, no TypeScript errors |
| Refresh code graph | `rtk graft build` | Graph rebuild completes |
| Find stale imports | `rg -n '@/components/(overview|routine-detail|routine-form|ui)|@/routines' apps/mobile/src` | No matches |
| Find re-export barrels | `rg -n '^\s*export\s+(\*|\{)' apps/mobile/src --glob '*.ts' --glob '*.tsx'` | No matches |

The mobile package defines lint and typecheck scripts in
`apps/mobile/package.json:6-13`. It has no test script or mobile test files.
This is a path-only refactor, so do not add a test framework or alter runtime
logic in this plan.

## Scope

**In scope**:

- Move `DailyOverview.tsx` from `apps/mobile/src/components/overview` to
  `apps/mobile/src/features/home`. Move `IntakeRow.tsx` and
  `RoutineRow.tsx` to `apps/mobile/src/features/home/components`.
- Move `UpcomingCard.tsx` from `apps/mobile/src/components/overview` to
  `apps/mobile/src/features/routines/components`. Both the home and as-needed
  screens use this routine card.
- Move the contents of `apps/mobile/src/routines` to
  `apps/mobile/src/features/routines`.
- Move `ActionRow.tsx`, `ChoiceRow.tsx`, and
  `RoutineDraftProvider.tsx` into `apps/mobile/src/features/routines`.
- Move routine route-screen implementations into
  `apps/mobile/src/features/routines/screens`.
- Move the history, intake-detail, and record-intake screen implementations
  into `apps/mobile/src/features/intakes/screens`.
- Move reusable UI modules from `apps/mobile/src/components/ui` to
  `apps/mobile/src/shared/ui`, preserving platform-specific filename pairs.
- Update all affected imports. Keep `src/app` route files and path segments,
  converting screen routes into import-and-render adapters. Do not use
  `export { default } from …` adapters.
- Delete `apps/mobile/src/components/ui/index.ts`. Do not add any barrel file.

Route-to-screen ownership:

| Existing route file, retained at the same path | Feature screen implementation |
|-----------------------------------------------|--------------------------------|
| `apps/mobile/src/app/index.tsx` | `apps/mobile/src/features/home/DailyOverview.tsx` |
| `apps/mobile/src/app/as-needed.tsx` | `apps/mobile/src/features/routines/screens/AsNeededScreen.tsx` |
| `apps/mobile/src/app/history.tsx` | `apps/mobile/src/features/intakes/screens/HistoryScreen.tsx` |
| `apps/mobile/src/app/intake/[id].tsx` | `apps/mobile/src/features/intakes/screens/IntakeDetailScreen.tsx` |
| `apps/mobile/src/app/record/[id].tsx` | `apps/mobile/src/features/intakes/screens/RecordIntakeScreen.tsx` |
| `apps/mobile/src/app/routine-detail/[id].tsx` | `apps/mobile/src/features/routines/screens/RoutineDetailScreen.tsx` |
| `apps/mobile/src/app/routine/[id]/index.tsx` | `apps/mobile/src/features/routines/screens/RoutineNameScreen.tsx` |
| `apps/mobile/src/app/routine/[id]/schedule.tsx` | `apps/mobile/src/features/routines/screens/RoutineScheduleScreen.tsx` |
| `apps/mobile/src/app/routine/[id]/review.tsx` | `apps/mobile/src/features/routines/screens/RoutineReviewScreen.tsx` |

Other source moves:

| Existing path | Target path |
|---------------|-------------|
| `apps/mobile/src/components/overview/IntakeRow.tsx` | `apps/mobile/src/features/home/components/IntakeRow.tsx` |
| `apps/mobile/src/components/overview/RoutineRow.tsx` | `apps/mobile/src/features/home/components/RoutineRow.tsx` |
| `apps/mobile/src/components/overview/UpcomingCard.tsx` | `apps/mobile/src/features/routines/components/UpcomingCard.tsx` |
| `apps/mobile/src/components/routine-detail/ActionRow.tsx` | `apps/mobile/src/features/routines/components/ActionRow.tsx` |
| `apps/mobile/src/components/routine-form/ChoiceRow.tsx` | `apps/mobile/src/features/routines/components/ChoiceRow.tsx` |
| `apps/mobile/src/components/routine-form/RoutineDraftProvider.tsx` | `apps/mobile/src/features/routines/RoutineDraftProvider.tsx` |
| Every module in `apps/mobile/src/routines` | Same basename directly under `apps/mobile/src/features/routines` |
| Every UI module except `index.ts` in `apps/mobile/src/components/ui` | Same basename under `apps/mobile/src/shared/ui` |

`apps/mobile/src/app/_layout.tsx` stays as the root navigator and updates
imports for `RoutinesProvider` and shared UI.
`apps/mobile/src/app/routine/[id]/_layout.tsx` stays as the routine wizard
navigator. Keep all route options, params, links, and screen behavior the same.

**Out of scope**:

- Renaming or changing any Expo route filename, dynamic segment, URL, or route
  registration.
- Changing routine/intake behavior, SQLite schema, reminders, permissions, or
  persistence ownership.
- Splitting the combined routine/intake store or adding layers beyond the
  approved feature folders.
- Updating mobile README/AGENTS instructions, adding tests/dependencies, or
  addressing the separate performance findings listed in `plans/README.md`.
- Editing files outside `apps/mobile/src` and this plan's status row.

## Git workflow

- Branch: `feature/mobile-feature-layout`.
- Keep the commit conventional, for example
  `refactor(mobile): group screens by feature`.
- Do not push or open a pull request unless the operator asks.

## Steps

### Step 1: Move shared UI and remove its barrel

Move every UI module except `index.ts` from
`apps/mobile/src/components/ui` to `apps/mobile/src/shared/ui`. Keep the
`ActionButton` and `SheetHeader` platform-specific pairs side by side. Update
imports in all mobile source files to name the owning UI modules directly.
Delete `apps/mobile/src/components/ui/index.ts` only after its eight consumers
use direct imports.

**Verify**: Run the stale-import and barrel-search commands above. Both return
no matches.

### Step 2: Move feature code and leave route adapters

Move the home overview modules, routine behavior/components, and intake-screen
implementations to the approved feature paths in the route ownership table.
Preserve implementation names where useful, and keep each screen's current
Expo Router hooks and screen options intact.

Replace each affected route screen body in `apps/mobile/src/app` with a small
component that imports and renders its feature screen. Keep every route file,
dynamic segment, `Stack.Screen` name, and route option. Update
`apps/mobile/src/app/_layout.tsx` to
import `RoutinesProvider` from `features/routines` and shared palette code from
`shared/ui`. Update all imports to the new paths. Delete empty old directories.

**Verify**: Confirm all route files listed in the table still exist at the same
paths, and the stale-import command returns no matches.

### Step 3: Run static checks and refresh the graph

Run mobile lint, mobile typecheck, and `rtk graft build`. Do not fix unrelated
lint/type issues outside this plan's scope.

**Verify**: All three commands exit successfully. Review `git status --short`
and confirm changes are limited to `apps/mobile/src` plus the plan status row.

## Test plan

- Add no tests. No business logic or route paths should change, and the mobile
  package currently has no test command.
- Run `bun run --filter mobile lint` → exit 0.
- Run `bun run --filter mobile typecheck` → exit 0.
- Verify route files remain at their exact original paths and no stale import
  or re-export barrel remains.
- Keep the domain behavior unchanged. Device testing is outside this
  path-only plan.

## Done criteria

- [ ] Implementations live under `apps/mobile/src/features/home`,
  `apps/mobile/src/features/routines`, and `apps/mobile/src/features/intakes`,
  with reusable UI under `apps/mobile/src/shared/ui`.
- [ ] All listed route files remain in `apps/mobile/src/app` at the same paths, and the
  root navigator declares the same route names.
- [ ] No import points to `@/components/overview`,
  `@/components/routine-detail`, `@/components/routine-form`,
  `@/components/ui`, or `@/routines`.
- [ ] No barrel/re-export file remains in `apps/mobile/src`.
- [ ] Mobile lint and typecheck both exit 0.
- [ ] No database, reminder, notification-permission, or user-facing behavior
  changes are present.
- [ ] No files outside scope are modified and the `plans/README.md` row is
  updated.

## STOP conditions

- The executor worktree does not include commit `1af7558` or a later reviewed
  state containing it.
- A route path, URL, dynamic parameter, or route registration would need to
  change to complete the move.
- A screen cannot move without changing routine/intake behavior or splitting
  the current local data store.
- A platform-specific UI file would be separated from its generic counterpart.
- A current-state excerpt no longer matches after the source changes have been
  preserved.
- Lint or typecheck still fails after two reasonable repair attempts.

## Maintenance notes

- Keep Expo Router route files in `src/app` as adapters. Add new product screen
  logic to the owning feature instead of putting it in a route file.
- Keep route path names stable when moving screen implementations. Review the
  root Stack declarations and all `router.push` / `router.dismissTo` callers.
- Keep shared UI independent of feature modules. Features may import shared UI.
- Keep feature dependencies one-way: home and intakes may use routine state,
  and home may use routine components. Routines must not import from home or
  intakes.
- Routine rules, local storage, and reminders remain together under routines
  and separate from presentation as required by ADR-0005.
- Future routine/intake store separation is explicitly deferred. Revisit it only
  with a separate domain decision and migration plan.
