# Nutritual

## Set up and run

Install workspace dependencies and start Expo with the Hono server:

```sh
bun install --frozen-lockfile
bun run dev
```

The server listens on port `3000`. Its harmless health response is available at
`/health`.

## Neon development branch

The app uses the Neon `development` branch. If this checkout is not linked yet,
sign in and select the branch:

```sh
bunx neon login
bunx neon link
bunx neon checkout development
bunx neon deploy
bunx neon status
```

Neon CLI writes database and Auth URLs to the ignored root `.env.local`. Add the
variables from [.env.example](.env.example) to that file. Keep the mobile Auth
URL equal to `NEON_AUTH_BASE_URL`, and keep the mobile client ID equal to
`MOBILE_OAUTH_CLIENT_ID`.

`EXPO_PUBLIC_SERVER_URL` is the origin the iPhone can reach. Set
`PUBLIC_BASE_URL` to the same origin for the phone pairing flow. Both values
must be the same public HTTPS ngrok origin for ChatGPT testing.

## Configure Neon OAuth

In the Neon Console, configure OAuth Provider on the `development` branch:

1. Set the MCP server URL to `PUBLIC_BASE_URL/mcp`.
2. Set the login and consent pages to `PUBLIC_BASE_URL/oauth/login` and
   `PUBLIC_BASE_URL/oauth/consent`, then add the public origin as a trusted
   domain.
3. Create a public OAuth client linked to the MCP resource. Keep PKCE and user
   consent enabled. Register the exact HTTPS callback
   `PUBLIC_BASE_URL/oauth/mobile/callback`.
4. Copy the configured public client ID (not necessarily a metadata URL) to `MOBILE_OAUTH_CLIENT_ID` and
   `EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID`.

The callback sends the authorization response back to the registered Expo
scheme, `com.erwannrousseau.nutritual:/oauth/callback`. The phone stores OAuth
tokens in SecureStore. The server verifies the issuer and `PUBLIC_BASE_URL/mcp`
audience for MCP and phone API calls.

The server stores only pairing metadata and one-time relay tickets in Postgres.
Products, routines, reminders, and intake history stay on the phone.

## Connect ChatGPT through ngrok

The free ngrok account provides one assigned development domain. Add the
authtoken in the local terminal, then start the tunnel with inspection disabled:

```sh
ngrok config add-authtoken <your-authtoken>
ngrok http 3000 --url https://<your-domain>.ngrok-free.dev --inspect=false
```

Check that full request and response capture is disabled in the ngrok account’s
Traffic Inspector settings. The local `--inspect=false` flag disables the
agent’s inspection interface. Do not use a paid domain or plan for this test.

Set `PUBLIC_BASE_URL` and `EXPO_PUBLIC_SERVER_URL` to the assigned HTTPS domain,
then restart the server and Expo. In the ChatGPT Business workspace, add a
custom MCP app at `PUBLIC_BASE_URL/mcp` using OAuth. Workspace admin settings
may need to allow custom apps and write actions.

From ChatGPT, start the connection and scan the QR code with the iPhone or enter
the short code in **Jumelage ChatGPT**. Approve the pairing on the signed-in
phone. Afterward, `create_intake_routine` creates an as-needed routine without
scheduling a reminder or asking the phone for another approval.

## Verify

Run the workspace checks:

```sh
bun run typecheck
bun run test
bun run lint
bun run fmt:check
bun run db:check
```

The database check requires `DATABASE_URL`. Check local server health with:

```sh
curl --fail http://localhost:3000/health
```

Expected response: `{"status":"ok"}`.

## Run on an iPhone

On a Mac with Xcode and the iPhone connected:

```sh
bun run --filter mobile ios:device <device-name>
```

The QR and manual-code flows, OAuth renewal, and actual ChatGPT-to-iPhone
creation still require verification with the configured Neon branch, ngrok
domain, ChatGPT Business workspace, and real iPhone.
