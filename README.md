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

If you are not signed in, run `bunx neon login`. Then link this checkout to the
Neon project and select the development branch:

```sh
npx neon link
npx neon checkout development
npx neon deploy
npx neon status
```

The CLI writes the Postgres connection strings to the ignored root `.env.local`.
Add `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and `EXPO_PUBLIC_SERVER_URL` to
that same file. See [.env.example](.env.example) for variable names and use a
private generated secret. `BETTER_AUTH_URL` is the server's own origin. Set
`EXPO_PUBLIC_SERVER_URL` to an address the phone can reach, such as the Mac's
LAN address during device testing. `localhost` only works when the app and API
run on the same device.

Better Auth stores its tables in the selected Neon Postgres branch. Apply the
schema with `bun run auth:migrate`, then check connectivity with
`bun run auth:check`. Both commands load the ignored root `.env.local`.

Public sign-up is disabled on the serving auth instance. To create the single
account, put `AUTH_PROVISION_EMAIL` and `AUTH_PROVISION_PASSWORD` in the ignored
root `.env.local` using a local editor, run `bun run auth:provision`, then remove
both temporary entries.
The command creates the account directly and does not start an HTTP server.

The Expo client stores the session in SecureStore. Routine routes stay locked
while the session is restored and after its expiry, including offline. A valid
cached session keeps local routines available without a server request on each
launch. Locking the app does not clear local products, routines, intake history,
durable operation records, or scheduled reminders.

## Verify

Run the workspace checks and service checks:

```sh
bun run typecheck
bun run test
bun run lint
bun run fmt:check
bun run db:check
bun run auth:check
```

The Postgres check runs `SELECT 1`. The Auth check verifies the configured
server handler and database. These checks require Internet access and Neon
credentials. Local app startup and `/health` do not require Neon credentials.
Check `/health` with:

```sh
curl --fail http://localhost:3000/health
```

Expected response: `{"status":"ok"}`.

## Run on an iPhone

On a Mac with Xcode:

```sh
bun run --filter mobile ios:device <device-name>
```
