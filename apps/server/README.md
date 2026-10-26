# Nutritual server

The Bun/Hono server hosts OAuth pages, phone pairing, the authenticated phone
API, the MCP endpoint, and the live WebSocket relay. Neon Managed Auth handles
identity. Postgres holds pairing metadata, hashed device credentials,
short-lived tickets, and rate-limit counters.

Products, routines, reminders, and intake history stay on the phone. The server
doesn't persist routine commands or log their payloads.

## Run

Follow the [development guide](../../docs/development.md) to configure Neon,
OAuth, the root `.env.local`, and ngrok. Start only the server from the
repository root:

```sh
bun --env-file=.env.local run --filter server dev
```

The default address is `0.0.0.0:3000`. `GET /health` returns `{"status":"ok"}`.

## Environment reference

| Variable                 | Purpose                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Neon Postgres connection for pairing state. Tables are created on first use.                                    |
| `NEON_AUTH_BASE_URL`     | Managed Auth issuer URL                                                                                         |
| `PUBLIC_BASE_URL`        | Public HTTPS origin without a trailing slash. The MCP resource and token audience are `${PUBLIC_BASE_URL}/mcp`. |
| `MOBILE_OAUTH_CLIENT_ID` | Configured public mobile OAuth client ID                                                                        |
| `PORT`                   | Listen port, defaults to `3000`                                                                                 |

The server requires the Auth URL, public origin, and mobile client ID at startup.
Use [`.env.example`](../../.env.example) as the workspace configuration reference.

## MCP tool

`create_intake_routine` creates an as-needed routine on the paired phone.

| Input         | Constraint                                                  |
| ------------- | ----------------------------------------------------------- |
| `productName` | Nonempty after trimming, at most 120 characters             |
| `operationId` | Caller-supplied UUID, reused when retrying the same request |

The tool doesn't accept a reminder schedule. It returns the phone's creation
outcome as JSON in the MCP text content.

Requests must belong to the paired ChatGPT OAuth client for the authenticated
Neon user. The first-party mobile OAuth client cannot call this tool.

## Pairing and delivery

Browser pairing challenges expire after five minutes. The phone binds a
challenge to its user and device after explicit approval. Terminal challenge
results can be consumed once. Relay tickets are single-use and expire after
60 seconds.

There is no persistent command queue. A request without a live paired phone
returns `unavailable`. A missing acknowledgment within 10 seconds, a disconnect,
or a send error returns `unconfirmed`. An unconfirmed result doesn't prove that
creation failed. Retry with the same `operationId` so the phone can deduplicate
the request, including after a restart.

Disconnecting ChatGPT removes the pairing and closes its relay. Existing phone
data remains. Neon controls token expiry and refresh. Removing the pairing
doesn't revoke the provider's OAuth tokens.

## Hosting constraint

MCP and the phone relay share one server process. Live connection state stays
in memory. A restart can interrupt pending requests, and multiple instances
need a different routing design. See
[ADR-0002](../../docs/adr/0002-combine-mcp-and-device-relay-in-one-process.md).
