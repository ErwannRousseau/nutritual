# Nutritual

## Install

```sh
bun install
```

## Start the local apps

```sh
bun run dev
```

The Hono backend runs on `http://localhost:3000`. Neon credentials are kept in
the ignored `.env.local` file. Run `npx neon deploy` after signing in to Neon to
provision the services declared in `neon.ts` and pull their environment values.

## Check Neon services

```sh
bun run db:check
bun run auth:check
```

The Postgres check runs `SELECT 1` to verify database access.
The Auth check makes an unauthenticated request to the branch's session endpoint
to verify service reachability. Neither command prints connection details.

## Verify the local foundation

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
```

`bun run dev` starts the Expo bundler and Hono server together. Starting the
local apps does not require Neon credentials.

## Install the iPhone development build

On a Mac with Xcode installed, connect the iPhone by USB, enable Developer Mode,
and install the app once:

```sh
bun run --filter mobile ios:device
```

The local iOS build requires a unique bundle identifier and Apple signing for
the connected device. After installation, stop the build command if it is still
running, start `bun run dev`, then open Nutritual on the iPhone and scan the
Expo QR code with its camera. Keep the phone and Mac on the same network.
