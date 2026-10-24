# Use Bun workspaces for the monorepo

Keep the Expo app in `apps/mobile`, the Bun backend in `apps/server`, and
shared command and response schemas in `packages/protocol`. Use Bun workspaces
with one lockfile and root scripts to install dependencies and run checks across
the repository. This keeps both ends of the device protocol aligned while
leaving storage and notifications in the mobile app, and authentication and
relay handling in the backend.

Do not add a separate task orchestrator such as Turborepo or Nx for this scope.
Expo supports Bun workspaces directly, so the initial setup does not require
another monorepo tool.

Source: [Expo monorepos](https://docs.expo.dev/guides/monorepos/).
