import { createVerifier } from "@neon/oauth/verify";
import { createMcpAuth } from "@neon/oauth/mcp";

const authBaseUrl = process.env.NEON_AUTH_BASE_URL;
const publicBaseUrl = process.env.PUBLIC_BASE_URL;
const mobileClientId = process.env.MOBILE_OAUTH_CLIENT_ID;

if (!authBaseUrl || !publicBaseUrl || !mobileClientId) {
  throw new Error("NEON_AUTH_BASE_URL, PUBLIC_BASE_URL, and MOBILE_OAUTH_CLIENT_ID are required.");
}

export const authVerifier = createVerifier({
  baseUrl: authBaseUrl,
  resource: `${publicBaseUrl.replace(/\/$/, "")}/mcp`,
});

export const mcpAuth = createMcpAuth({
  baseUrl: authBaseUrl,
  resource: `${publicBaseUrl.replace(/\/$/, "")}/mcp`,
});

export const config = {
  authBaseUrl: authBaseUrl.replace(/\/$/, ""),
  publicBaseUrl: publicBaseUrl.replace(/\/$/, ""),
  mobileClientId,
};
