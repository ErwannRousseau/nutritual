# Nutritual

## Set up and run

Install the workspace dependencies and start the local apps:

```sh
bun install --frozen-lockfile
bun run dev
```

The command starts Expo and the Hono API at `http://localhost:3000`.

## Use Neon locally

Local development uses the Neon `development` branch. It is a child of the
default `production` branch. A new branch starts from its parent's data, then
keeps later writes separate. Keep production data out of development.

If you are not signed in, run `npx neon login`. Then link this checkout to the
Neon project and select the development branch:

```sh
npx neon link
npx neon checkout development
npx neon deploy
npx neon status
```

The CLI writes Postgres and Neon Auth settings to the ignored `.env.local`. See
[.env.example](.env.example) for the variable names. `neon.ts` enables Neon
Managed Better Auth, which stores managed identity data in the `neon_auth`
schema. `bun run auth:check` checks that the service responds. It does not test
sign-in or session restoration.

## Verify

Run the static checks and service checks:

```sh
bun run typecheck
bun run test
bun run db:check
bun run auth:check
```

The Postgres check runs `SELECT 1`. The Auth check requests the branch's session
endpoint. Both require Internet access and Neon credentials. Local app startup
and `/health` do not require Neon credentials. Check `/health` with:

```sh
curl --fail http://localhost:3000/health
```

Expected response: `{"status":"ok"}`.

On 2026-10-24, both Neon checks succeeded on `development`. This records
connectivity only, not an end-user authentication flow.

## Neon Free plan

As checked on 2026-10-24, Neon Free includes 100 projects per account, 1 GB of
Postgres storage, 100 CU-hours per project each month, autoscaling up to 2 CU,
and 10 branches per project. Managed Better Auth supports up to 60,000 monthly
active users on Free.
[Check Neon's current limits](https://neon.com/blog/neon-free-plan-1-gb-per-project)
before relying on them. Confirm the project stays on Free in the Neon Console.
This setup does not authorize a paid upgrade.

## Run on an iPhone

On a Mac with Xcode:

```sh
bun run --filter mobile ios:device <device-name>
```
