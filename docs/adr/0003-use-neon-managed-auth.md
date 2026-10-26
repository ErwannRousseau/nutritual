# Use Neon Managed Auth for the phone and ChatGPT

## Decision

Use Neon Managed Better Auth as the only identity provider for the mobile app
and the ChatGPT MCP server. Do not add a self-hosted Better Auth instance or
run two authentication systems in parallel.

The mobile app uses a public OAuth client with authorization code and PKCE. It
stores access and rotating refresh tokens in iOS SecureStore. The app uses the
same Neon issuer and resource as the server. The server verifies Neon tokens
through `@neon/oauth` and checks the exact issuer and the MCP resource audience
for both MCP and phone API requests.

The Bun server hosts the OAuth login and consent pages required by Neon. ChatGPT
uses the MCP authorization flow and the phone approves a five-minute pairing
challenge. Pairing state, device credentials, and one-time relay tickets live
in Postgres. Products, routines, reminders, and intake history remain on the
phone as defined in
[ADR 0001](0001-keep-domain-data-on-the-phone.md).

The first MCP tool creates only an as-needed intake routine. The phone does not
schedule a reminder for it. Commands are transient and retain the delivery,
acknowledgment, operation identity, and deduplication guarantees from issue
[#5](https://github.com/ErwannRousseau/nutritual/issues/5).

Disconnecting ChatGPT deletes the phone pairing and closes the relay. MCP
requests without a paired phone cannot create routines. Neon-issued OAuth
tokens are still governed by Neon’s expiry and refresh-token rules, so the
application must not claim that deleting a phone pairing revokes those tokens.
Confirm the provider’s available revocation behavior before relying on a
stronger revocation guarantee.

## Configuration and validation

Neon OAuth is configured per branch. Configure the branch’s OAuth provider with
the public server’s MCP URL, login page, consent page, and trusted HTTPS origin.
Create a public mobile client for the same MCP resource and register the
server’s HTTPS mobile callback. Keep the native `com.erwannrousseau.nutritual`
scheme registered in the Expo app.

Neon’s OAuth provider supports public clients with PKCE and refresh tokens, but
the provider flow, cookies, cross-device approval, token renewal, and ChatGPT
Business behavior require end-to-end verification with a real iPhone and
workspace. See the [Neon OAuth Provider documentation](https://neon.com/docs/auth/guides/plugins/oauth-provider).

The development server must stay behind an HTTPS ngrok endpoint for ChatGPT
testing. Disable request inspection in both the local ngrok agent and the
account’s Traffic Inspector settings. Do not enable a paid tunnel upgrade.
