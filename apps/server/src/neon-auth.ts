import { createVerifier } from "@neon/oauth/verify";
import { createMcpAuth } from "@neon/oauth/mcp";
import { MOBILE_OAUTH_CLIENT_ID, NEON_AUTH_BASE_URL, PUBLIC_BASE_URL } from "./env.ts";

export const authVerifier = createVerifier({
  baseUrl: NEON_AUTH_BASE_URL,
  resource: `${PUBLIC_BASE_URL.replace(/\/$/, "")}/mcp`,
});

export const mcpAuth = createMcpAuth({
  baseUrl: NEON_AUTH_BASE_URL,
  resource: `${PUBLIC_BASE_URL.replace(/\/$/, "")}/mcp`,
});

export const config = {
  authBaseUrl: NEON_AUTH_BASE_URL.replace(/\/$/, ""),
  publicBaseUrl: PUBLIC_BASE_URL.replace(/\/$/, ""),
  mobileClientId: MOBILE_OAUTH_CLIENT_ID,
};
