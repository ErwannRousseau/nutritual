# Nutritual server

The Bun/Hono server hosts the Neon OAuth pages, browser-to-phone pairing, the
authenticated phone API, the MCP endpoint, and the live phone relay. Routine
data stays on the phone. The server stores only pairing metadata, device
credentials as hashes, short-lived tickets, and rate-limit counters.

## Configuration

Set these variables in the server environment:

```dotenv
DATABASE_URL=
NEON_AUTH_BASE_URL=
PUBLIC_BASE_URL=
MOBILE_OAUTH_CLIENT_ID=
PORT=3000
```

- `DATABASE_URL` is a Neon Postgres connection string. The server creates its
  pairing tables on first use. Keep this separate from phone routine data.
- `NEON_AUTH_BASE_URL` is the Managed Better Auth issuer base URL.
- `PUBLIC_BASE_URL` is the public HTTPS origin serving this app, with no path.
  The MCP resource is `${PUBLIC_BASE_URL}/mcp` and is also the phone API token
  audience.
- `MOBILE_OAUTH_CLIENT_ID` is the configured ID of the first-party public
  mobile OAuth client. That client receives explicit OAuth consent after sign-in. Other
  clients use the phone approval page.

Configure Neon Managed Auth with the server's public trusted origin, the custom
login page `${PUBLIC_BASE_URL}/oauth/login`, and the custom consent page
`${PUBLIC_BASE_URL}/oauth/consent`. Configure the mobile client's redirect URI
as `${PUBLIC_BASE_URL}/oauth/mobile/callback`. That route redirects the original
OAuth callback query unchanged to `com.erwannrousseau.nutritual:/oauth/callback`.
Register the MCP resource `${PUBLIC_BASE_URL}/mcp` with the OAuth provider.

## Run locally

From the repository root:

```sh
bun --env-file=.env.local run --filter server dev
```

The server listens on `0.0.0.0:3000` by default. `/health` returns
`{"status":"ok"}`. Do not expose it publicly until Neon Auth custom pages,
trusted origins, the mobile redirect URI, and the MCP resource are configured.

## Pairing and relay behavior

Browser pairing challenges expire after five minutes and store hashes of the
short code, poll token, and signed OAuth query. The authenticated phone binds
the challenge to its Neon subject and device only after explicit approval. The
browser sends the exact OAuth query back to Managed Auth only after phone
approval or decline. A challenge's terminal result can be consumed once.
Rate limits and pairing records persist in Postgres. The phone obtains a
one-time WebSocket ticket that expires after 60 seconds.

The server relays `create_intake_routine` only to the phone paired to the
authenticated Neon user. There is no command queue. A request without a live
phone returns `unavailable`; a missing acknowledgment within 10 seconds or a
disconnect returns `unconfirmed`. Retry with the same `operationId` so the
phone can deduplicate a request whose outcome was not confirmed.

The only MCP tool is `create_intake_routine`. It creates an as-needed routine
and accepts `productName` and a caller-supplied stable `operationId`.
