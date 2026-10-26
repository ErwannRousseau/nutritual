# Plan 004: Move the pairing workflow out of PairScreen

> **Executor instructions**: Follow this plan step by step. Run every
> verification command. Update the plan row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 5d4d727..HEAD -- apps/mobile/src/features/auth/screens/PairScreen.tsx apps/mobile/src/features/auth/phone-api.ts apps/mobile/src/features/auth/phone-responses.ts apps/mobile/src/features/auth/parse.ts apps/mobile/src/features/auth/pending-pair-link.ts`
> Stop if the current pairing contract or workflow differs from this plan.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — this flow authorizes a phone and depends on the exact code that was inspected.
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `5d4d727`, 2026-10-26

## Why this matters

`PairScreen` currently owns six pieces of pairing form state, code synchronization,
network calls, secure persistence, approval/decline, and completion navigation
alongside its layout. A feature-owned hook and testable pairing operations make
the security-sensitive transitions easier to read and verify without changing
the server contract.

## Current state

- `apps/mobile/src/features/auth/screens/PairScreen.tsx` owns the code input,
  message, busy/valid state, inspected code, and OAuth request details.
- Its `inspect()` normalizes the code, calls
  `/api/phone/pairing-challenges/inspect` with `phoneResponses.pending`, stores
  the code in SecureStore, and publishes returned details.
- Its `decide(approve)` refuses to proceed unless the normalized current code
  equals the inspected code and the inspection is still valid. Approval obtains
  device credentials and posts to `/approve`; decline posts to `/decline`.
- Successful decisions remove the pending code and navigate to `/settings`
  after 700 ms. Failures keep the pending code available and show the existing
  generic failure message.
- `features/auth/phone-api.ts` handles authorized requests and response guards.
  `phone-responses.ts` supplies their validators. `parse.ts` owns
  `normalizePairCode`. `AuthProvider.tsx` supplies `getDeviceCredentials()`.
- `features/auth/pending-pair-link.ts` already coordinates incoming deep links
  and has focused tests. Do not replace or duplicate that coordinator.

## Commands you will need

Run from the repository root:

- Typecheck: `bun run --filter mobile typecheck` — exit 0, no errors.
- Lint: `bun run --filter mobile lint` — exit 0, no errors.
- Tests: `bun run --filter mobile test` — all mobile tests pass.
- Format: `bun run fmt:check apps/mobile/src/features/auth` — all auth files
  formatted.

## Scope

**In scope**:

- `apps/mobile/src/features/auth/screens/PairScreen.tsx`
- `apps/mobile/src/features/auth/usePairingFlow.ts` (create)
- `apps/mobile/src/features/auth/pairing-flow.ts` (create only if needed as a dependency-free test seam)
- `apps/mobile/src/features/auth/pairing-flow.test.ts` (create)

**Out of scope**: backend pairing API, request/response schemas, OAuth scope,
device credential creation, deep-link coordinator, and navigation route shape.

## Git workflow

Use the branch assigned by the operator. Follow Conventional Commit style, for
example `refactor(mobile): group screens by feature`. Do not push unless asked.

## Steps

### Step 1: Define a feature-owned pairing hook

Move form state, initial-code synchronization, secure pending-code persistence,
inspection, approval/decline, and action callbacks into
`features/auth/usePairingFlow.ts`. Keep `PairScreen` responsible for the route
parameter and rendering the returned state. Reuse the existing API, response
guards, parser, SecureStore key, and device credentials function.

**Verify**: mobile typecheck passes; screen JSX no longer contains API or
SecureStore calls.

### Step 2: Preserve and test pairing transitions

Extract only the smallest pure operation seam needed to test async transitions
with injected request/storage/credential functions. Do not build a generic
workflow framework. Add tests for malformed code, inspection success/failure,
approval guard for a changed code, approval success/failure, decline success,
and SecureStore deletion only after success. Keep failure messages and
pending-code behavior unchanged.

**Verify**: focused tests pass under Bun without new test dependencies.

### Step 3: Keep the screen declarative and run all checks

Have `PairScreen` render the hook's code input, request details, message,
loading state, and callbacks. Preserve disabled-state behavior and the 700 ms
completion delay. Run all commands from the table.

**Verify**: lint, typecheck, tests, and auth formatting exit 0; inspect that
`normalizePairCode(codeInput.value) === inspectedCode` remains an enforced
precondition to both approval and decline.

## Test plan

Use Bun's built-in test runner as in `phone-api.test.ts` and
`pending-pair-link.test.ts`. Unit-test the extracted pure transition functions
with injected functions; do not require native SecureStore or network calls in
unit tests. Assert both requests carry the validated code and approval alone
includes device credentials. Verify decline never requests credentials. Verify
storage deletion and delayed navigation occur only after a successful response.
On errors, assert the code remains stored and the current failure feedback is
returned.

Run `bun run --filter mobile test` from the repository root.

## Done criteria

- [ ] `PairScreen` contains no pairing API orchestration or secure persistence.
- [ ] The hook stays within `features/auth` and uses existing contracts.
- [ ] The inspected-code equality guard protects both decisions.
- [ ] Tests cover success, failure, malformed or changed code, and cleanup.
- [ ] Mobile lint, typecheck, tests, and auth formatting pass.
- [ ] No files outside the in-scope list changed.

## STOP conditions

- Stop if the backend API or response validators changed from the described
  contracts; update the plan before changing the API shape.
- Stop if the code guard cannot be retained for both approval and decline.
- Stop if the test seam requires weakening response validation or adding a
  dependency.

## Maintenance notes

Treat `inspectedCode` as the authorization boundary for the visible details.
Whenever request parsing, OAuth details, or pairing endpoints change, update
the hook and its transition tests together. Deep-link arrival and persistence
ordering remain owned by `pending-pair-link.ts`.
