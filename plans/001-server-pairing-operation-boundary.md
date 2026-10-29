# Plan 001: Separate pairing operations from server route adapters

> **Executor instructions**: Follow this plan step by step. Run each verification command and confirm its expected result before continuing. Stop if a condition in “STOP conditions” occurs. When complete, update this plan’s status in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 77632bd..HEAD -- apps/server/src/app.ts apps/server/src/pairing-store.ts apps/server/src/pairing-operations.ts apps/server/src/routes/device.ts apps/server/src/routes/pairing.ts apps/server/src/routes/phone.ts apps/server/src/routes/mcp.ts apps/server/src/pairing-operations.test.ts apps/server/src/device-routes.test.ts apps/server/src/pairing-routes.test.ts apps/server/src/phone-routes.test.ts apps/server/src/index.test.ts`
> If an in-scope file changed since this plan was written, compare the excerpts below with the current code. Stop if a cited behavior or responsibility has changed.

## Status

- **Priority**: P1
- **Effort**: M (approximately 1 day)
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `77632bd`, 2026-10-26

## Why this matters

The repository’s architecture rule says to separate route adapters from application operations and persistence, but pairing and device routes currently validate requests, execute SQL, coordinate transactions, and map outcomes to HTTP responses in the same handlers. The split makes authorization and persistence behavior harder to review independently and leaves the route modules coupled to the database schema. After this change, Hono routes will keep authentication, request validation, and response mapping, while application operations coordinate the existing workflows and a persistence module owns SQL and transaction access.

## Current state

Relevant files:

- `apps/server/src/app.ts` — constructs the Hono app and the single shared `RoutineRelay`, then registers server routes.
- `apps/server/src/routes/pairing.ts` — creates and reads OAuth pairing challenges, including direct challenge-table queries.
- `apps/server/src/routes/phone.ts` — inspects and approves challenges, disconnects devices, and issues tickets. It owns direct SQL and the multi-statement approval transaction.
- `apps/server/src/routes/device.ts` — consumes one-time tickets and checks pairing state from the WebSocket open callback.
- `apps/server/src/routes/mcp.ts` — reads the paired OAuth client in the MCP handler before constructing the MCP transport.
- `apps/server/src/pairing-store.ts` — owns the Postgres pool, lazy table creation, hashing, rate limiting, and cleanup, but not the pairing workflow queries currently in routes.
- `apps/server/src/routine-relay.ts` — the existing server-side operation module for live phone delivery.
- `apps/server/src/{pairing-routes,phone-routes,device-routes,index}.test.ts` — exercise route behavior with fake database clients and test the MCP helper predicates.

Examples from the current code:

```ts
// apps/server/src/routes/phone.ts:135-138
const client = await database.connect();

try {
  await client.query("BEGIN");
```

The same file continues with row locking, conflict handling, account/device checks, challenge update, commit or rollback, and HTTP responses (`phone.ts:140-228`). Other route-owned SQL includes challenge creation and consumption (`pairing.ts:101-117`, `pairing.ts:141-166`), atomic device-ticket consumption (`device.ts:31-44`), and paired-client lookup (`mcp.ts:32-40`). An exhaustive search at the planned commit found route queries in those four route files, while `pairing-store.ts` owns the database helpers.

The route modules also depend on one another for a setting: `phone.ts:12` imports `ticketLifetimeMs` from `routes/device.ts:16,97`. Move this value to the pairing operation or persistence boundary so one route no longer imports another route.

The repository instruction is explicit: `AGENTS.md:13-15` says to keep HTTP/MCP transport, authentication, pairing, and live relay in `apps/server`, and to separate route adapters from application operations and persistence. Keep shared wire contracts in `packages/protocol` (`AGENTS.md:16-18`).

Preserve the existing hosting and data decisions. ADR 0002 says MCP and the authenticated phone WebSocket stay in one process and one instance (`docs/adr/0002-combine-mcp-and-device-relay-in-one-process.md:3-5`). The phone remains the owner of products, routines, reminders, and intake history (`AGENTS.md:24-25`). This plan does not change either decision.

Follow the local module shape: `app.ts:11-24` creates shared runtime services once and passes them to `register*Routes`. `routine-relay.ts:27-30,203-210` keeps operation state inside `createRoutineRelay()` and exposes a small set of named operations. Use that as an example for one focused pairing operations module. Do not introduce a generic repository framework or dependency-injection container.

## Commands you will need

Run commands from the repository root. No installation is needed.

| Purpose | Command | Expected on success |
|---|---|---|
| Server tests | `bun run --filter server test` | Exit 0, all server tests pass |
| Server typecheck | `bun run --filter server typecheck` | Exit 0, no TypeScript errors |
| Server lint | `bun run --filter server lint` | Exit 0, no lint errors |
| Full typecheck | `bun run typecheck` | Exit 0 |
| Full lint | `bun run lint` | Exit 0 |
| Full tests | `bun run test` | Exit 0, all workspace tests pass |
| Formatting | `bun run fmt:check` | Exit 0, no formatting differences |

## Scope

**In scope**:

- `apps/server/src/app.ts`
- `apps/server/src/pairing-store.ts`
- `apps/server/src/pairing-operations.ts` (new)
- `apps/server/src/routes/device.ts`
- `apps/server/src/routes/pairing.ts`
- `apps/server/src/routes/phone.ts`
- `apps/server/src/routes/mcp.ts`
- `apps/server/src/pairing-operations.test.ts` (new)
- `apps/server/src/device-routes.test.ts`
- `apps/server/src/pairing-routes.test.ts`
- `apps/server/src/phone-routes.test.ts`
- `apps/server/src/index.test.ts` if pure MCP helper exports move

**Out of scope**:

- `apps/server/src/routine-relay.ts` and its single-process runtime model
- `apps/server/src/routes/oauth-pages.ts` and OAuth page rendering
- `packages/protocol`, mobile code, endpoint paths, request/response schemas, and environment configuration
- Database schema changes, migrations, a durable command queue, or multi-instance routing

## Git workflow

- Use a `feature/` branch, for example `feature/server-pairing-operation-boundary`.
- Use conventional commits. Existing examples include `refactor(protocol): centralize routine result statuses` and `fix(auth): validate pairing before admitting a phone`.
- Do not push, commit, or open a pull request unless the operator asks.

## Steps

### Step 1: Add the pairing persistence and operation boundary

Keep SQL and transaction access in `pairing-store.ts`. Add only the focused database functions needed by the existing pairing, device-ticket, and paired-client workflows. Add `pairing-operations.ts` for multi-step application behavior and result decisions. Use a small store factory or the existing dependency-injection shape only as needed so tests can supply the current fake database clients. Compose one operation service in `app.ts` and pass it to route registrations. Keep the existing `RoutineRelay` instance shared and pass it to the disconnect operation where coordination with the live connection is required.

Do not add a class hierarchy, generic repository, table-per-module layout, or compatibility exports. Keep the ticket lifetime setting outside route modules.

**Verify**: `bun run --filter server typecheck` → exit 0. `bun run --filter server test` → all current tests pass, plus any new operation tests.

### Step 2: Make route modules adapters

Update `pairing.ts`, `phone.ts`, `device.ts`, and `mcp.ts` to call the pairing operations instead of issuing SQL. Keep request authentication, Zod validation, endpoint paths, response payloads, and status mapping in the routes. Keep WebSocket setup and message parsing in `device.ts`, and keep MCP server/tool/transport construction in `mcp.ts`. Remove obsolete route-level database dependencies, imports, and the `phone.ts` to `device.ts` constant import after all callers move.

Preserve these existing data and ordering guarantees:

- Challenge codes, poll tokens, OAuth query values, device secrets, and tickets remain hashed before persistence where they are hashed today.
- Approval keeps its `SELECT ... FOR UPDATE`, insert conflict handling, existing-device comparison, challenge update, commit, rollback, and connection release behavior.
- Ticket consumption remains atomic and single-use. Preserve the current `UPDATE ... RETURNING` condition that also checks the device is still paired.
- WebSocket connection approval still rechecks that the same device and pairing are active before registering the phone with the relay.
- Disconnect still removes only the matching device credentials, closes the matching relay connection, and deletes that pairing’s tickets in the current order.
- MCP still allows only the paired ChatGPT client and rejects the first-party mobile client.

Keep existing route tests as HTTP contract tests. Adapt their fixtures to build the operation service over the existing fake database so they still exercise the route-to-operation-to-store path. Add focused operation assertions for transaction failure/rollback and the paired-client decision where current coverage does not reach those branches.

**Verify**: `bun run --filter server test` → all route and operation tests pass. `! rg -n 'database\.(query|connect)|client\.query' apps/server/src/routes` → exit 0 with no matches.

### Step 3: Run the full workspace checks and review scope

Run the full repository checks listed above. Review the diff to confirm that public HTTP/MCP behavior and database schema remain unchanged and that all SQL moved from route modules to persistence code.

**Verify**: `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run fmt:check` → each exits 0. `git status --short` → only in-scope files are changed.

## Test plan

- Preserve and update the route scenarios in `pairing-routes.test.ts`, `phone-routes.test.ts`, and `device-routes.test.ts`. They currently use fake Postgres clients and exercise challenge creation/status, ownership checks, approval outcomes, one-time tickets, and relay connection checks.
- Add `pairing-operations.test.ts` for the extracted application behavior. Cover approval success, account mismatch, conflicting existing device, transaction rollback on failure, one-time ticket consumption, disconnecting only the matching pairing, and MCP paired-client allow/deny decisions.
- Keep the pure MCP error/client predicate assertions in `index.test.ts` if those helpers remain there. If a helper moves, update its import and assertions rather than retaining a route compatibility export.
- Model the new tests on the existing fake database setup in `phone-routes.test.ts:22-226` and the route registration fixture in `pairing-routes.test.ts:104-121`.
- Verification: `bun run --filter server test` → all server tests pass, including the new operation cases.

## Done criteria

- [ ] Route modules contain no `database.query`, `database.connect`, or `client.query` calls.
- [ ] `phone.ts` no longer imports `ticketLifetimeMs` from `device.ts`.
- [ ] SQL and transaction access for pairing/device metadata live behind the persistence boundary. Multi-step pairing and device workflows live behind application operations.
- [ ] Existing endpoint paths, authentication rules, response bodies/status codes, ticket lifetime, schema, and relay behavior are unchanged.
- [ ] Approval transaction and ticket single-use behavior have meaningful success and failure assertions.
- [ ] `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run fmt:check` all exit 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

Stop and report instead of improvising if:

- The current route or transaction behavior no longer matches the excerpts and guarantees above.
- Moving ticket consumption would require splitting its atomic SQL condition into separate reads and writes.
- The refactor requires a schema migration, public contract change, new auth provider, durable queue, or multi-instance relay design.
- A route cannot use the operations boundary without adding a generic repository/container or duplicating query logic.
- A verification command fails twice after a reasonable repair attempt.

## Maintenance notes

Future pairing endpoints should follow the same route → application operation → persistence direction. Review transaction ordering, row-lock scope, hash-before-persist behavior, and HTTP error mapping whenever pairing logic changes. The one-process relay and phone-owned routine data remain governed by ADR 0002 and the repository architecture instructions.
