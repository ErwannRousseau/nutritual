This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Feature-based architecture

Organize code by the feature that owns its behavior:

| Directory                | Responsibility                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `src/features/auth/`     | Authentication, sessions, phone pairing, and account settings.                                        |
| `src/features/home/`     | Daily overview and its components.                                                                    |
| `src/features/routines/` | Routine creation and management, domain models, state, SQLite storage, reminders, and relay handling. |
| `src/features/intakes/`  | Recording intakes, intake details, and history screens.                                               |
| `src/shared/ui/`         | Reusable UI primitives, palette, and layout helpers without feature dependencies.                     |

- Keep screens, components, hooks, domain logic, and tests with their owning feature. Create subdirectories only when needed.
- Keep `src/app/` for Expo Router layouts and thin route adapters that render feature screens. Put screen behavior and UI in the feature.
- Keep the combined routine/intake state and persistence in `features/routines/`. Intake screens consume those modules directly.
- Import from the file that defines a symbol. Do not add barrel files or forwarding re-exports, including in route adapters.

## Component styles

- Define all styles below the components in the same file, including typography and dynamic style calculations.
- Put static styles in a module-level `StyleSheet.create(...)` declaration below the components. Put theme- or prop-dependent styles in a `createStyles(...)` helper below the components.
- Inside a component, consume named styles or call the helper, for example `useMemo(() => createStyles(colors), [colors])`. Keep style objects and `StyleSheet.create(...)` out of component bodies and JSX.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Run workspace commands from the repository root. Run one-off Expo tools from
`apps/mobile` with Bun so Expo uses this app's SDK and configuration.

```bash
bun run dev
bun run --filter mobile ios
bun run --filter mobile lint
bun run --filter mobile typecheck
bun run --filter mobile test
```

From `apps/mobile`, run one-off Expo commands:

```bash
bunx expo install <package>
bunx expo install --fix
bunx expo-doctor
```

Run lint and typecheck before declaring any code work done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Route adapters live in `src/app/`, and `_layout.tsx` files define navigators. Feature screens live in `src/features/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
