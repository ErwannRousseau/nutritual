# Plan 002: Align mobile command guidance with Bun

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. Do not improvise. When done, update the status row for this plan in `advisor-plans/README.md`.
>
> **Drift check (run first)**: `rtk git diff --stat 77632bd..HEAD -- apps/mobile/AGENTS.md`. Also inspect `rtk git diff -- apps/mobile/AGENTS.md` and `rtk git diff --cached -- apps/mobile/AGENTS.md` because the revision comparison omits local changes. Compare the command section below with the live file before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `77632bd`, 2026-10-26
- **Execution correction**: Bun 1.4.2 does not accept the planned `bun --cwd apps/mobile x ...` invocation. `bunx expo --version` was verified from `apps/mobile`, so use `bunx` there for one-off Expo CLI tools.

## Why this matters

`apps/mobile/AGENTS.md` says to use `bunx` when the repository has `bun.lock`, then shows `npx` commands. Its lint and typecheck examples also bypass the mobile workspace scripts. Aligning the examples with the commands already used by this repository gives future contributors and agents one clear workflow without changing app behavior.

## Current state

- The root `AGENTS.md` says to use Bun workspaces and run workspace commands from the repository root.
- `apps/mobile/AGENTS.md:36-44` currently says:

  ```sh
  Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

  npx expo install <package>
  npx expo start
  npx expo lint
  npx tsc --noEmit
  npx expo-doctor
  npx expo install --fix
  ```

- `apps/mobile/package.json:6-14` defines `dev`, `ios`, `ios:device`, `lint`, `typecheck`, and `test` scripts. The mobile lint script runs Oxlint.
- The root `package.json:10-17` defines the workspace `dev`, `lint`, `typecheck`, `test`, and `fmt:check` commands.
- `apps/mobile/README.md:9-24` is the local example. It runs `bun run dev` from the repository root and uses `bun run --filter mobile` for iOS commands.
- The separate EAS and Rules sections contain other `npx` examples. They are outside this plan's Commands-section scope.

## Commands you will need

| Purpose                   | Command                                     | Expected on success                                                    |
| ------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| Check command section     | `rtk sed -n '34,56p' apps/mobile/AGENTS.md` | No `npx` commands, and each workspace command matches a package script |
| Check Expo CLI runner    | `rtk bunx expo --version` from `apps/mobile` | Exit 0 and prints the installed Expo CLI version                  |
| Typecheck                 | `rtk bun run typecheck`                     | Exit 0 with no errors                                                  |
| Lint                      | `rtk bun run lint`                          | Exit 0 with no errors                                                  |
| Tests                     | `rtk bun run test`                          | Exit 0 with all tests passing                                          |
| Format check              | `rtk bun run fmt:check`                     | Exit 0 with no formatting changes requested                            |

Run workspace commands from the repository root. The repository's root `package.json` supplies these exact scripts.

## Scope

**In scope**:

- `apps/mobile/AGENTS.md`
- `advisor-plans/README.md` (update this plan's status when finished)

**Out of scope**:

- `apps/mobile/package.json`, root `package.json`, and all application source files.
- Root `AGENTS.md`, `apps/mobile/README.md`, and other documentation.
- The separate Building with EAS and Rules sections in `apps/mobile/AGENTS.md`.
- Any dependency change or toolchain migration.
- All other files.

## Git workflow

- If a new branch is needed, use `feature/mobile-bun-command-guidance`.
- Use a conventional commit such as `docs(mobile): align command guidance with bun` if a commit is requested.
- Do not push or open a pull request unless the operator asks.

## Steps

### Step 1: Replace the conflicting command examples

Edit only the Commands section in `apps/mobile/AGENTS.md`.

- Use the existing workspace scripts for development, lint, typecheck, and tests. Preserve the repository-root working directory. Use the README's `bun run dev` and `bun run --filter mobile ios` examples as the pattern.
- Replace `npx expo lint` with `bun run --filter mobile lint` so the guide names the existing Oxlint script.
- Replace `npx tsc --noEmit` with `bun run --filter mobile typecheck`.
- Keep Expo SDK-aware install commands. For one-off Expo commands, use `bunx` from the app workspace, for example `bunx expo install <package>`, `bunx expo install --fix`, and `bunx expo-doctor`.
- Replace the conditional `bunx` versus `npx` sentence with a direct note to run workspace commands from the repository root and one-off Expo tools from `apps/mobile` through `bunx`.
- Keep the instruction to run lint and typecheck before declaring code work done.

Do not add a new package script or replace `expo install` with `bun add`. Keep the command block short and limited to commands the repository already supports.

**Verify**: `rtk sed -n '34,56p' apps/mobile/AGENTS.md` → the Commands section has no `npx` commands and uses Bun workspace scripts or `bunx` from `apps/mobile`. Run `rtk bunx expo --version` with `apps/mobile` as the working directory → exit 0 and prints the installed Expo CLI version.

### Step 2: Check formatting and repository commands

Run the repository's typecheck, lint, tests, and format check from the root.

**Verify**: `rtk bun run typecheck`, `rtk bun run lint`, `rtk bun run test`, and `rtk bun run fmt:check` → each exits 0.

## Test plan

- This is a documentation-only change. No new test is needed.
- Confirm every workspace command in the edited section exists in the root or mobile `package.json`.
- Confirm one-off Expo commands use `bunx` from `apps/mobile` and retain the Expo SDK-aware `expo install` behavior.
- Run the four repository checks in Step 2. Formatting is the check that directly covers this Markdown change.

## Done criteria

- [ ] The Commands section in `apps/mobile/AGENTS.md` has no `npx` examples or contradictory Bun guidance.
- [ ] Lint and typecheck examples name the existing mobile workspace scripts.
- [ ] Expo install examples keep SDK-aware `expo install` and use Bun.
- [ ] `rtk bun run typecheck`, `rtk bun run lint`, `rtk bun run test`, and `rtk bun run fmt:check` exit 0.
- [ ] Only the in-scope files are changed, plus the status update in `advisor-plans/README.md`.

## STOP conditions

Stop and report if:

- The mobile package scripts or root scripts no longer match the current-state section.
- `bunx expo --version` cannot run from `apps/mobile`. Do not substitute an unverified package-manager command.
- The edit appears to require changing root guidance, package scripts, or other documentation.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- When mobile scripts change, update this command section from the package scripts rather than inventing direct CLI equivalents.
- Keep the Bun workspace directory rule clear. One-off Expo tools need the mobile app working directory so Expo reads `apps/mobile` configuration.
- This plan does not validate an Expo build or simulator launch. It only aligns the written commands with the current workspace configuration.
