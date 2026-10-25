# Authentication: iOS verification

Checked on 25 October 2026 with Better Auth 1.7.13 and the Neon `development`
branch.

## Observed checks

- Applied Better Auth's `user`, `session`, `account`, and `verification` tables
  to the Neon development branch. The Postgres and Better Auth connectivity
  checks succeeded.
- A local Hono handler returned `EMAIL_PASSWORD_SIGN_UP_DISABLED` for public
  registration and `INVALID_EMAIL_OR_PASSWORD` for an unknown account. The test
  requests used synthetic credentials and did not create an account.
- The single account was provisioned on Neon from temporary values in the
  ignored root `.env.local`. Those provisioning values were removed afterward.
- The iPhone 13 simulator build and launch succeeded. Synthetic invalid
  credentials showed the generic sign-in error, and opening a protected routine
  deep link while signed out returned to the sign-in screen.
- Signing in with the provisioned account opened the existing local routines.
  Relaunch restored the session. With the local auth server stopped, relaunch
  still showed the routines and opened a stored routine detail. The simulator's
  Metro connection remained available, so this verifies an unavailable auth
  server rather than full device airplane mode.
- The first successful sign-in exposed a native input update after its screen
  unmounted. The sign-in screen no longer clears those fields on success.
  After reloading the JavaScript bundle, React DevTools reported no active
  component errors or warnings.
- Workspace typechecking, lint, server tests (14), mobile tests (3), and
  formatting checks on changed files passed.
- The full workspace format check still reports three unchanged files:
  `apps/mobile/src/app/routine/[id]/index.tsx`,
  `plans/001-mobile-feature-layout.md`, and `plans/README.md`.

## Remaining verification

- Developer Mode applies to the physical iPhone, not the simulator. If the
  setting is missing, connect and pair the iPhone with Xcode first. Then open
  Settings > Privacy & Security > Developer Mode, enable it, restart, and
  confirm with the device passcode. See [Apple's instructions](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device?changes=_8).
- The physical iPhone 13 was discovered by agent-device. Xcode could not install
  on the first attempt because the phone was locked. The next install command
  exited successfully, but agent-device could not launch the app because
  Developer Mode is disabled. Retry `agent-device open
  com.erwannrousseau.nutritual --foreground --device "rlit1 iPhone"` after
  enabling it.
- Expiration blocking while offline, full airplane-mode use, preservation of
  local data through reauthentication, and continued reminders remain
  unverified on the physical phone.
