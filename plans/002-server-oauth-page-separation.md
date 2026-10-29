# Plan 002: Separate OAuth page content from route registration

> **Executor instructions**: Follow this plan step by step. Run each verification command and confirm its expected result before continuing. Stop if a condition in “STOP conditions” occurs. When complete, update this plan’s status in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 77632bd..HEAD -- apps/server/src/routes/oauth-pages.ts apps/server/src/oauth-page-content.ts apps/server/src/oauth-pages.test.ts`
> If an in-scope file changed since this plan was written, compare the excerpts below with the current code. Stop if page routes or browser behavior have changed.

## Status

- **Priority**: P2
- **Effort**: M (approximately 1 day)
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `77632bd`, 2026-10-26

## Why this matters

`routes/oauth-pages.ts` currently registers HTTP routes and embeds both browser workflows, page markup, and styling in one module. The scripts are strings, so TypeScript does not analyze their browser APIs or branches. The existing test executes the login script, but no test executes the longer consent and phone-polling script. Separating page rendering from Hono route registration will make each concern easier to review and gives the consent workflow a focused test seam without adding a frontend build system.

## Current state

Relevant files:

- `apps/server/src/routes/oauth-pages.ts` — registers `/oauth/login`, `/oauth/consent`, and `/oauth/mobile/callback`; it currently contains all page markup, inline CSS, and browser scripts.
- `apps/server/src/oauth-pages.test.ts` — serves the login page through Hono, extracts its script, and executes it with `node:vm` and mocked browser APIs. It covers signup with an active session and signup waiting for email verification.
- `apps/server/src/neon-auth.ts` — provides the configured Auth base URL and mobile client ID used by the pages.

Current rendering and route registration are combined:

```ts
// apps/server/src/routes/oauth-pages.ts:7-15
function html(body: string, scripts: string): string {
  return `<!doctype html>...<style>${pageStyle}</style><main>${body}</main><script>${scripts}</script></html>`;
}

export function registerOAuthPages(app: Hono<McpAuthVariables>): void {
  app.get("/oauth/login", (c) => c.html(html(/* markup */, /* browser script */)));
```

The second browser application is embedded in the consent route at `oauth-pages.ts:76-141`. It handles mobile-client consent as well as ChatGPT pairing, challenge creation, polling, approval, decline, mismatch, and expiry. The current test helper only requests `/oauth/login` and extracts that page’s script (`oauth-pages.test.ts:33-39`).

The existing test pattern is useful: `oauth-pages.test.ts:33-39,73-108` builds a Hono app, extracts the actual served script, then evaluates it in `runInNewContext` with controlled `document`, `location`, and `fetch` values. Extend this harness for consent instead of adding a browser automation dependency.

Keep the provider flow intact. ADR 0003 says the Bun server hosts the OAuth login and consent pages required by Neon (`docs/adr/0003-use-neon-managed-auth.md:15-17`). Preserve `/oauth/login`, `/oauth/consent`, and `/oauth/mobile/callback`, the original `oauth_query` forwarding, and the native callback redirect. Continue inserting configuration values into JavaScript using `JSON.stringify`, as the current code does.

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

- `apps/server/src/routes/oauth-pages.ts`
- `apps/server/src/oauth-page-content.ts` (new)
- `apps/server/src/oauth-pages.test.ts`

**Out of scope**:

- Neon configuration, authentication provider behavior, callback URL, and mobile OAuth flow
- Pairing endpoints, pairing persistence, the MCP route, and `packages/protocol`
- New dependencies, bundlers, static-asset hosting configuration, or frontend application scaffolding

## Git workflow

- Use a `feature/` branch, for example `feature/server-oauth-page-separation`.
- Use conventional commits. Existing examples include `feat(auth): support account creation during OAuth sign-in` and `fix(auth): preserve the latest pairing link through sign-in`.
- Do not push, commit, or open a pull request unless the operator asks.

## Steps

### Step 1: Extract page rendering from Hono route registration

Create `apps/server/src/oauth-page-content.ts` for the shared page shell/style and two focused render functions: one for login and one for consent. Pass the needed public configuration values into the render functions. Move the existing markup and browser script text without changing its behavior. Keep `registerOAuthPages` responsible for the three paths, calling the page renderers for login and consent and preserving the mobile callback redirect.

Do not add a frontend compiler or serve new external asset files. Keep configuration interpolation escaped with `JSON.stringify`. Keep scripts and page markup out of the route adapter after the extraction.

**Verify**: `bun run --filter server typecheck` → exit 0. `bun run --filter server test` → existing OAuth signup tests pass unchanged in behavior.

### Step 2: Add a deterministic consent-flow test seam

Extend `oauth-pages.test.ts` using its current Hono-plus-VM pattern. Request `/oauth/consent`, extract the served script, and supply mock DOM elements, location, browser session response, pairing endpoints, OAuth consent response, and navigation.

Cover these paths:

- Mobile client: allow and deny both submit the correct `accept` value with the original OAuth query.
- Paired ChatGPT client: challenge creation and status polling preserve the original query, then an `approved` result continues consent and navigates to the provider URL.
- Mismatch or expired challenge: show the corresponding status and do not submit approval.

Resolve the first polling iteration through a controlled response. Do not make the test wait for the real five-minute challenge expiry or contact Neon/network services.

**Verify**: `bun run --filter server test` → both existing signup tests and the new consent cases pass deterministically.

### Step 3: Run the full workspace checks and review scope

Run the full repository checks listed above. Review the served HTML and redirects to confirm the extraction did not change route paths, scripts, or query forwarding.

**Verify**: `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run fmt:check` → each exits 0. `git status --short` → only in-scope files are changed.

## Test plan

- Keep the existing signup tests in `oauth-pages.test.ts` for successful continuation and the no-session/email-verification path.
- Add behavioral tests for the native consent allow/deny path and the ChatGPT challenge-approved path.
- Add a failure-path test for a mismatched or expired challenge and assert that consent is not continued.
- Use `runInNewContext` and the existing mocked-fetch setup in `oauth-pages.test.ts:33-119`; do not add a new browser test dependency.
- Verification: `bun run --filter server test` → all OAuth page tests pass without real timers or network requests.

## Done criteria

- [ ] `routes/oauth-pages.ts` contains route registration and the native callback redirect, not inline page scripts or markup.
- [ ] `oauth-page-content.ts` owns the page shell, styling, markup, and the login/consent browser script strings without importing Hono.
- [ ] Login, consent, and mobile callback routes retain their current paths and observable request/redirect behavior.
- [ ] Tests execute the consent script and cover both mobile consent and paired ChatGPT approval, including a non-success challenge state.
- [ ] No new package or build/asset-serving configuration is added.
- [ ] `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run fmt:check` all exit 0.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

Stop and report instead of improvising if:

- The current OAuth routes or script behavior no longer match the paths and flows described above.
- Extracting page content requires changes to Neon provider settings, the mobile callback scheme, or public request/response contracts.
- Static assets would require a new deployment/build pipeline to be served correctly.
- The consent tests require real network access or waiting for the production challenge timeout.
- A verification command fails twice after a reasonable repair attempt.

## Maintenance notes

Keep route registration in `routes/oauth-pages.ts` and browser page content in `oauth-page-content.ts`. When changing OAuth query forwarding, browser session lookup, challenge polling, or callback navigation, update the VM behavior tests in the same change. Review configuration escaping and the exact `oauth_query` payload during every consent-page change.
