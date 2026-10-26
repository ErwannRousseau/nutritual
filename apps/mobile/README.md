# Nutritual mobile

The Expo app stores supplement routines and intake history on the phone. It
schedules local reminders and receives routine creation requests from ChatGPT
through the authenticated server relay.

Development targets iOS first. Use a development build rather than Expo Go.

## Run

Follow the root [development guide](../../docs/development.md) for dependencies,
environment variables, Neon OAuth, and the tunnel. From the repository root:

```sh
bun run dev
```

Install the iPhone development build from another terminal:

```sh
bun run --filter mobile ios:device "<device-name>"
```

Use `bun run --filter mobile ios` for an iOS simulator.

## App behavior

- Routines can use selected weekdays, an interval in calendar days, or no
  schedule. You can edit, delete, pause, and resume them.
- The phone schedules reminders in local time. Interval reminders have finite
  coverage and renew when the app opens or returns to the foreground.
- Recording an intake adds a dated history entry. You can undo an entry.
  A notification alone never records an intake.
- A ChatGPT request currently creates an as-needed routine. The phone must stay
  open and connected during creation. It keeps operation IDs in SQLite to
  prevent duplicate creation on retries.

## Source layout

| Path             | Responsibility                                                         |
| ---------------- | ---------------------------------------------------------------------- |
| `src/app`        | Expo Router routes and screen composition                              |
| `src/components` | Shared UI and routine forms                                            |
| `src/routines`   | Routine state, SQLite persistence, reminders, and relay handling       |
| `src/auth`       | OAuth sign-in, SecureStore tokens, pairing, and authenticated requests |

The UI uses the universal `@expo/ui` API. See
[ADR-0005](../../docs/adr/0005-use-expo-ui-for-the-ios-routine-milestone.md)
for the native control boundaries.
