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
- The iPhone 13 simulator build and launch succeeded. Synthetic invalid
  credentials showed the generic sign-in error, and opening a protected routine
  deep link while signed out returned to the sign-in screen.
- Workspace typechecking, lint, server tests (14), mobile tests (3), and
  formatting checks on changed files passed.
- The full workspace format check still reports three unchanged files:
  `apps/mobile/src/app/routine/[id]/index.tsx`,
  `plans/001-mobile-feature-layout.md`, and `plans/README.md`.

## Remaining verification

- The single account was provisioned on Neon from temporary values in the
  ignored root `.env.local`. Those provisioning values were removed afterward.
- A successful sign-in with that account has not yet been observed in the app.
- The physical iPhone 13 was discovered by agent-device. Xcode could not install
  on the first attempt because the phone was locked. The next install command
  exited successfully, but agent-device could not launch the app because
  Developer Mode is disabled. Enable it, restart and unlock the phone, then
  retry `agent-device open com.erwannrousseau.nutritual --foreground --device
  "rlit1 iPhone"`.
- Successful sign-in, relaunch, valid-session offline use, expiration blocking,
  preservation of local data, and continued reminders remain unverified on the
  phone.
