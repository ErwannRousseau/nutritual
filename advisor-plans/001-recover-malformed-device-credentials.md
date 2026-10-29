# Plan 001: Recover from malformed device credentials

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. Do not improvise. When done, update the status row for this plan in `advisor-plans/README.md`.
>
> **Drift check (run first)**: `rtk git diff --stat 77632bd..HEAD -- apps/mobile/src/features/auth/AuthProvider.tsx apps/mobile/src/features/auth/device-credentials.test.ts`. Also inspect `rtk git diff --` and `rtk git diff --cached --` for those paths because the revision comparison omits local changes. Compare any changed lines with the excerpts below before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `77632bd`, 2026-10-26

## Why this matters

The phone stores its device ID and secret in SecureStore. If that saved value is malformed JSON, `getDeviceCredentials()` throws before reaching its existing invalid-value recovery path. The relay catches the error and keeps retrying, while pairing and disconnect actions show their existing failure messages. Treating malformed JSON like the other invalid stored values lets those callers reach the existing credential creation path while preserving errors from SecureStore itself.

## Current state

- `apps/mobile/src/features/auth/AuthProvider.tsx` defines `getDeviceCredentials()` and stores the phone's pairing credentials.
- `apps/mobile/src/features/routines/relay.ts:37-45,93-95` reads the credentials before requesting a device ticket. A failure schedules another connection attempt.
- `apps/mobile/src/features/auth/usePairingFlow.ts:17-38` provides the same function to pairing approval. `apps/mobile/src/features/auth/pairing-flow.ts:51-65` reports a failed approval when credential loading rejects.
- `apps/mobile/src/features/auth/screens/SettingsScreen.tsx:36-52` uses the function when disconnecting and reports request errors.
- `apps/mobile/src/features/auth/pairing-flow.test.ts` tests pairing decisions with a stub credential service. It does not exercise SecureStore parsing.
- `apps/mobile/src/features/routines/create-routine-from-relay.test.ts:79-108` shows the repository's Bun pattern for mocking Expo modules before importing code. Follow that pattern for `expo-secure-store` and `expo-crypto`.

Current implementation excerpt from `apps/mobile/src/features/auth/AuthProvider.tsx:61-87`:

```ts
if (existing) {
  const parsed: JsonValue = JSON.parse(existing);

  if (isJsonObject(parsed)) {
    const deviceId = String(parsed.deviceId ?? "");
    const deviceSecret = String(parsed.deviceSecret ?? "");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
      uuid.test(deviceId) &&
      deviceId === parsed.deviceId &&
      uuid.test(deviceSecret) &&
      deviceSecret === parsed.deviceSecret
    ) {
      return { deviceId, deviceSecret };
    }
  }
}

const { randomUUID } = await import("expo-crypto");
const value = { deviceId: randomUUID(), deviceSecret: randomUUID() };
await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify(value));

return value;
```

The intended behavior is already present for a missing value or a parsed value with invalid fields. Malformed JSON should reach that same fallback. Keep the existing UUID validation and returned shape. Keep SecureStore read and write failures visible to callers.

The domain decision in `docs/adr/0001-keep-domain-data-on-the-phone.md:3-7` keeps routine and intake data on the phone and allows the server to retain only pairing and authentication metadata. This plan changes only local device-credential parsing. It does not change server pairing records or routine data.

## Commands you will need

| Purpose              | Command                            | Expected on success                         |
| -------------------- | ---------------------------------- | ------------------------------------------- |
| Focused mobile tests | `rtk bun run --filter mobile test` | Exit 0, including the new credential tests  |
| Typecheck            | `rtk bun run typecheck`            | Exit 0 with no errors                       |
| Lint                 | `rtk bun run lint`                 | Exit 0 with no errors                       |
| Full tests           | `rtk bun run test`                 | Exit 0 with all tests passing               |
| Format check         | `rtk bun run fmt:check`            | Exit 0 with no formatting changes requested |

These are the repository's Bun workspace scripts from the root `package.json`. Run them from the repository root.

## Scope

**In scope**:

- `apps/mobile/src/features/auth/AuthProvider.tsx`
- `apps/mobile/src/features/auth/device-credentials.test.ts` (create)
- `advisor-plans/README.md` (update this plan's status when finished)

**Out of scope**:

- `apps/mobile/src/features/routines/relay.ts`, `apps/mobile/src/features/auth/usePairingFlow.ts`, and `apps/mobile/src/features/auth/screens/SettingsScreen.tsx`. Their current error handling remains in place.
- Pairing API contracts, server pairing persistence, session tokens, credential format, and the SecureStore key.
- Any migration or compatibility path.
- All other files.

## Git workflow

- If a new branch is needed, use `feature/mobile-device-credential-recovery`.
- Use a conventional commit such as `fix(mobile): recover malformed device credentials` if a commit is requested.
- Do not push or open a pull request unless the operator asks.

## Steps

### Step 1: Add focused device-credential tests

Create `apps/mobile/src/features/auth/device-credentials.test.ts`. Use `bun:test`. Mock `expo-secure-store` and `expo-crypto` before dynamically importing `getDeviceCredentials()` from `./AuthProvider`.

Cover these cases:

1. A valid saved UUID pair is returned unchanged and is not rewritten.
2. Malformed JSON resolves to a newly generated UUID pair and writes that pair to SecureStore.
3. Valid JSON with invalid fields follows the existing regeneration path.
4. SecureStore read and write failures still reject.

Use deterministic UUID values that pass the current UUID check. Keep the test local to this exported function. Do not move the function or add a storage abstraction.

**Verify**: `rtk bun run --filter mobile test` → the existing tests pass and the malformed-JSON case fails because `JSON.parse` rejects the input.

### Step 2: Let malformed JSON reach the existing fallback

In `getDeviceCredentials()`, catch only the `JSON.parse(existing)` failure. Continue into the current UUID generation and SecureStore write path when parsing fails. Keep parsed-object validation unchanged. Leave SecureStore read and write errors uncaught.

**Verify**: `rtk bun run --filter mobile test` → all mobile tests pass, including the malformed, valid, invalid-shape, read-error, and write-error cases.

### Step 3: Run repository checks

Run typecheck, lint, full tests, and format check from the repository root.

**Verify**: `rtk bun run typecheck`, `rtk bun run lint`, `rtk bun run test`, and `rtk bun run fmt:check` → each exits 0.

## Test plan

- Add `apps/mobile/src/features/auth/device-credentials.test.ts` for the exported helper.
- Model Expo module mocking on `apps/mobile/src/features/routines/create-routine-from-relay.test.ts:79-108`.
- Assert the generated credentials are persisted and returned after malformed JSON.
- Assert valid credentials are reused without another write.
- Assert SecureStore API errors still reject so transient storage failures are not hidden.
- Run `rtk bun run --filter mobile test` and then all four repository checks listed in Step 3.

## Done criteria

- [ ] Malformed SecureStore JSON reaches the existing credential regeneration path.
- [ ] Valid saved credentials are reused.
- [ ] SecureStore read and write errors still reject.
- [ ] `rtk bun run typecheck`, `rtk bun run lint`, `rtk bun run test`, and `rtk bun run fmt:check` exit 0.
- [ ] Only the in-scope files are changed, plus the status update in `advisor-plans/README.md`.

## STOP conditions

Stop and report if:

- `getDeviceCredentials()` has moved or no longer matches the excerpt above.
- The tests show that malformed JSON must preserve an existing server pairing in a way the current recovery path cannot support. Do not change the server contract to solve this plan.
- The fix requires catching SecureStore read or write failures, changing credential validation, changing callers, or changing server code.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Keep the credential format and UUID checks aligned with the server's pairing contract.
- Review the error boundary carefully. Only malformed stored JSON should take the regeneration path. SecureStore access failures must remain observable to relay, pairing, and disconnect callers.
- This plan does not test a physical device. Use the existing pairing flow for device-level confirmation when that work is requested.
