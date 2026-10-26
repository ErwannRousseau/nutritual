# Run Nutritual locally and connect ChatGPT

This guide sets up the server on Mac and the app on iPhone. Once paired, ChatGPT
can add supplement routines to Nutritual.

Needs Bun, Xcode, a Neon project with Managed Auth, a free ngrok account, and a
ChatGPT workspace that allows custom MCP apps and write actions. Enable
Developer Mode on the iPhone before installing the app.

Run all commands from the repository root.

## Install dependencies and link Neon

```sh
bun install --frozen-lockfile
```

The project uses the Neon `development` branch. For an unlinked checkout, sign
in, select the project, and provision the services declared in `neon.ts`:

```sh
bunx neon login
bunx neon link
bunx neon checkout development
bunx neon deploy
```

Neon CLI writes database and Auth URLs to the ignored root `.env.local`. Keep
those values when completing the configuration below.

## Set the server origin and environment

Start a tunnel using ngrok's free assigned development domain:

```sh
ngrok config add-authtoken <authtoken>
ngrok http 3000 --url https://<domain>.ngrok-free.dev --inspect=false
```

Keep this terminal open. The tunnel forwards HTTPS requests to the local server
on port `3000`, which starts after configuring OAuth.

Disable full request and response capture in the ngrok account's Traffic
Inspector settings. `--inspect=false` disables only the local agent's inspection
interface.

Complete the root `.env.local` using [`.env.example`](../.env.example). Use the
same ngrok HTTPS origin, without a trailing slash, for OAuth and MCP. The mobile
client ID comes from the next section.

| Variable                             | Value                                              |
| ------------------------------------ | -------------------------------------------------- |
| `DATABASE_URL`                       | Pooled Neon Postgres connection string             |
| `DATABASE_URL_UNPOOLED`              | Direct Postgres connection for administrative work |
| `NEON_BRANCH`                        | `development`                                      |
| `NEON_AUTH_BASE_URL`                 | Managed Auth issuer URL for this branch            |
| `PUBLIC_BASE_URL`                    | ngrok HTTPS origin                                 |
| `MOBILE_OAUTH_CLIENT_ID`             | Public mobile client ID created in Neon OAuth      |
| `EXPO_PUBLIC_SERVER_URL`             | Same value as `PUBLIC_BASE_URL`                    |
| `EXPO_PUBLIC_NEON_AUTH_BASE_URL`     | Same value as `NEON_AUTH_BASE_URL`                 |
| `EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID` | Same value as `MOBILE_OAUTH_CLIENT_ID`             |

Keep credentials in ignored environment files. The mobile bundle includes
`EXPO_PUBLIC_*` values, so these must contain only public configuration.

If `apps/mobile/.env.local` exists, make its public values match the root file.
Use the public HTTPS origin on the iPhone. A loopback address such as
`127.0.0.1` points to the phone itself.

## Configure Neon OAuth

Open the OAuth provider settings on the Neon `development` branch. Replace
`<public-origin>` with ngrok HTTPS origin.

| Setting                    | Value                                   |
| -------------------------- | --------------------------------------- |
| MCP resource               | `<public-origin>/mcp`                   |
| Login page                 | `<public-origin>/oauth/login`           |
| Consent page               | `<public-origin>/oauth/consent`         |
| Trusted domain             | `<public-origin>`                       |
| Mobile client redirect URI | `<public-origin>/oauth/mobile/callback` |

Create a public mobile OAuth client linked to the MCP resource. Enable PKCE and
user consent. Copy its client ID into `MOBILE_OAUTH_CLIENT_ID` and
`EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID`.

Register the HTTPS callback above in Neon. The server forwards the authorization
response to the app using its native scheme:

```text
com.erwannrousseau.nutritual:/oauth/callback
```

## Start the app and server

Start Expo and the server with the root environment:

```sh
bun run dev
```

In another terminal, install the development build on the connected iPhone:

```sh
bun run --filter mobile ios:device "<device-name>"
```

For an iOS simulator, use `bun run --filter mobile ios`. The app uses a
development build, not Expo Go.

At first sign-in, choose **Créer un compte** on the Nutritual login page.
Register with an email address and password. This Nutritual account belongs to
the selected Neon branch and is separate from Neon Console account.

## Connect ChatGPT

1. In the ChatGPT Business workspace, add a custom MCP app at
   `<public-origin>/mcp` with OAuth.
2. Start authorization from ChatGPT. Scan the QR code with the iPhone, or enter
   the short code in **Jumelage ChatGPT** in Nutritual's settings.
3. Approve the connection on the signed-in phone. The code expires after five
   minutes. Start authorization again if it expires.
4. Keep Nutritual open and connected. Ask ChatGPT to add a supplement routine,
   then confirm the action in ChatGPT.

ChatGPT creates an as-needed routine without another approval on the phone. To
add reminders, edit the routine's frequency and time in the app. Scheduling
reminders through ChatGPT isn't implemented yet.

## Fix setup problems

| Problem                               | Action                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| OAuth uses an old origin              | Update both `.env.local` files, the Neon settings, and the ChatGPT app URL. Restart Expo and the server. |
| OAuth doesn't return to the app       | Use the exact HTTPS callback registered in Neon and keep the native scheme in the development build.     |
| The phone cannot reach the server     | Use the ngrok HTTPS origin and keep the tunnel and server running.                                       |
| ChatGPT reports the phone unavailable | Reopen Nutritual and sign in with the paired account.                                                    |
| Creation is unconfirmed               | Retry with the same `operationId`. A new ID can create another routine.                                  |

See the [server reference](../apps/server/README.md) for authentication,
pairing, and relay behavior.

## Verification

Run the automated checks from the repository root:

```sh
bun run typecheck
bun run test
bun run lint
bun run fmt:check
```

The tests cover OAuth continuation, pairing authorization, authenticated relay
delivery, and preserving pairing links through sign-in.

On 26 October 2026, the maintainer confirmed that the real ChatGPT-to-iPhone
routine creation flow works. The code review did not repeat that live flow or
recheck the tunnel and provider settings.
