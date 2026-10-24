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

Start with Neon Managed Auth, powered by Better Auth, for the actual application
integration. Evaluate email and password sign-in, Expo session restoration, and
the ChatGPT MCP authorization requirements with the managed service first.
Compatibility is not yet validated, but a switch to self-hosted Better Auth is
not a predetermined implementation step. Record any observed limitation and
its impact on the required workflow before deciding whether a switch is needed.
Only if the managed integration fails or does not meet the requirements should
Better Auth in the Bun backend with Neon Postgres be considered. Do not build
both authentication paths in parallel. Provision one account for the first
milestone, disable public registration, and defer Apple and Google sign-in until
the end-to-end workflow is proven.

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
