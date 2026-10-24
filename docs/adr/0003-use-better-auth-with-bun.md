# Trial Neon Managed Better Auth with Bun

Use Neon Postgres with Neon Managed Better Auth for the first authentication
integration trial, rather than starting with only a Postgres connection and
self-hosted Better Auth. Neon Managed Better Auth is based on Better Auth and
stores authentication data in the Neon project. Keep development separate from
any future production database, and keep products, intake routines, and intake
history on the phone as defined in
[ADR 0001](0001-keep-domain-data-on-the-phone.md).

Use Neon Free for the trial. This decision does not authorize a paid upgrade,
and pricing and quotas must be checked again before provisioning.

Treat this as a trial, not a validated production decision. Neon Managed Auth
does not expose MCP OAuth or custom Better Auth plugins and handlers. Better
Auth's Expo integration requires its Expo client plugin for secure cookie and
session storage, which the managed client does not accept. The managed service
can be evaluated for basic email and password sign-in, with public registration
disabled, but it cannot satisfy the target Expo session-restoration and ChatGPT
MCP OAuth flows. Use Better Auth in the Bun backend with this Neon Postgres
database for those flows, and implement the secure CIMD transport described
below. Provision one account for the first milestone and defer Apple and Google
sign-in until the end-to-end workflow is proven.

For the self-hosted fallback, keep Bun. Its documented fetch capabilities allow
connecting to a chosen IP address while preserving the original HTTP host, SNI,
and TLS certificate verification. Resolve each hostname once, reject the request
if any resolved address is special-use or not publicly routable, connect only to
an approved address, refuse redirects, and honor the supplied method, headers,
and abort signal. Apply this to CIMD documents and their associated resources.
Targeted tests must verify these guarantees, including in Vercel's Bun runtime,
before treating the connection as operational.

Sources:
[Neon Free plan](https://neon.com/blog/neon-free-plan-1-gb-per-project),
[Neon Auth plugin support](https://neon.com/docs/auth/guides/plugins.md),
[Better Auth MCP](https://better-auth.com/docs/plugins/mcp),
[Better Auth Expo integration](https://better-auth.com/docs/integrations/expo),
[Better Auth CIMD](https://better-auth.com/docs/plugins/cimd),
[Bun Fetch](https://bun.sh/docs/runtime/networking/fetch).
