# Nutritual

Nutritual organizes dietary supplement intake routines and local reminders on
the phone, with routine creation from ChatGPT through an authenticated relay.

## Workspace

- Use Bun workspaces. Run workspace commands from the repository root.

## Architecture and ownership

- Keep mobile screens and behavior feature-based under `apps/mobile/src/features`.
- Keep HTTP/MCP transport, authentication, pairing, and live device relay in
  `apps/server`. Separate route adapters from application operations and
  persistence.
- Keep shared wire contracts and runtime validation in `packages/protocol`.
  Keep this package independent of either application and update both consumers
  with any contract change instead of duplicating schemas or validation rules.
- Use Neon Managed Auth as the identity provider for the mobile app and the
  ChatGPT MCP server.

## Data ownership

- Store products, routines, reminders, and intake history on the phone. Persist
  only the authentication and pairing metadata needed by the server.

## Validation

- For code changes, run `bun run typecheck`, `bun run lint`, `bun run test`,
  and `bun run fmt:check`. Report any checks that could not run.
- Review how the affected behavior is already tested. Complete and strengthen
  existing tests with meaningful assertions, edge cases, and failure paths.
  Add new tests where coverage is missing, rather than automatically adding
  an isolated regression test for each change.
- For database connectivity changes, run `bun run db:check` with the configured
  development environment. Do not treat connectivity as proof of sign-in,
  pairing, or complete ChatGPT-to-phone operation.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default triage labels. See `docs/agents/triage-labels.md`.

### Change delivery

Choose a Ship, Show, or Ask path for each change. See
`docs/agents/ship-show-ask.md`.

### Domain docs

Use the single-context layout. See `docs/agents/domain.md`.

### Mobile architecture

Before adding, moving, or reviewing mobile code, read `apps/mobile/AGENTS.md`
for feature ownership, route boundaries, direct imports, and style placement.
