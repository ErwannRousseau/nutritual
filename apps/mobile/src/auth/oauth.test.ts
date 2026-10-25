import { expect, test } from "bun:test";
import { createCodeExchangeParams } from "./oauth";

test("authorization code exchange includes the MCP resource and PKCE verifier", () => {
  expect(
    createCodeExchangeParams({
      clientId: "mobile-client",
      code: "authorization-code",
      redirectUri: "https://api.example.test/oauth/mobile/callback",
      codeVerifier: "pkce-verifier",
      resource: "https://api.example.test/mcp",
    }),
  ).toEqual({
    clientId: "mobile-client",
    code: "authorization-code",
    redirectUri: "https://api.example.test/oauth/mobile/callback",
    extraParams: {
      code_verifier: "pkce-verifier",
      resource: "https://api.example.test/mcp",
    },
  });
});
