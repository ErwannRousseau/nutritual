# Use Better Auth with Bun

Use Better Auth in the backend for sessions and ChatGPT OAuth authorization,
with its MCP and Expo integrations. This reuses an existing protocol
implementation without requiring a separate identity provider. Persistent data
is limited to identity, sessions, pairing, and authorization records, as defined
in [ADR 0001](0001-keep-domain-data-on-the-phone.md).

Use PostgreSQL on Neon's free plan for this storage. The user has no existing
database and accepts creating one provided it remains on a free plan. This
decision does not authorize a paid upgrade.

Use a dedicated development database on Neon Free from the start, rather than
running PostgreSQL locally with Docker Compose. The mobile app and backend run
locally during development, while authentication storage remains remote. This
avoids maintaining a local database service and requires internet access for
authentication. Keep development data separate from any future production
database. Free-plan quotas apply, and current pricing is not a guarantee of
permanent free service.

The first milestone uses email and password authentication, with one account
provisioned during setup and no public registration. Defer Apple and Google
sign-in until the complete workflow has been proven. The user signs in to
Nutritual before approving ChatGPT's OAuth connection through the QR flow.
Better Auth handles OAuth, while the QR interface and temporary approval handoff
remain application responsibilities.

Keep Bun. Its documented fetch capabilities allow connecting to a chosen IP
address while preserving the original HTTP host, SNI, and TLS certificate
verification. This provides a basis for implementing Better Auth's required
secure CIMD transport without switching runtimes.

The transport must resolve the hostname once, reject the request if any resolved
address is special-use or not publicly routable, connect only to an approved
address, refuse redirects, and honor the supplied method, headers, and abort
signal. Use it for CIMD documents and their associated resources. Targeted tests
must verify these guarantees, including in Vercel's Bun runtime, before treating
the connection as operational.

Sources: [Better Auth MCP](https://better-auth.com/docs/plugins/mcp),
[Better Auth CIMD](https://better-auth.com/docs/plugins/cimd),
[Bun Fetch](https://bun.sh/docs/runtime/networking/fetch),
[Better Auth PostgreSQL](https://better-auth.com/docs/adapters/postgresql),
[Neon pricing](https://neon.com/pricing).
