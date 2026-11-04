import { useState } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { saveTokens } from "@/features/auth/session";
import { createTokenSet } from "@/features/auth/session-model";
import { useAuth } from "@/features/auth/AuthProvider";
import { createCodeExchangeParams } from "@/features/auth/oauth";
import {
  EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID,
  EXPO_PUBLIC_NEON_AUTH_BASE_URL,
  EXPO_PUBLIC_SERVER_URL,
} from "@/env";

WebBrowser.maybeCompleteAuthSession();

const issuer = EXPO_PUBLIC_NEON_AUTH_BASE_URL;
const clientId = EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID;
const server = EXPO_PUBLIC_SERVER_URL;
const callbackUri = `${server.replace(/\/$/, "")}/oauth/mobile/callback`;

export function useOAuthSignIn(onError: (message: string) => void) {
  const { setSession } = useAuth();
  const discovery = AuthSession.useAutoDiscovery(issuer);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [request] = AuthSession.useAuthRequest(
    {
      clientId,
      responseType: AuthSession.ResponseType.Code,
      scopes: ["openid", "offline_access"],
      redirectUri: callbackUri,
      usePKCE: true,
      extraParams: { resource: `${server.replace(/\/$/, "")}/mcp` },
    },
    discovery,
  );

  async function signIn() {
    if (!request || !discovery) {
      onError("Mobile OAuth sign-in is not configured.");

      return;
    }

    setIsSubmitting(true);

    try {
      const authUrl = await request.makeAuthUrlAsync(discovery);

      const nativeReturn = AuthSession.makeRedirectUri({
        native: "com.erwannrousseau.nutritual:/oauth/callback",
      });

      const browser = await WebBrowser.openAuthSessionAsync(authUrl, nativeReturn);

      if (browser.type !== "success") return;
      const result = request.parseReturnUrl(browser.url);

      if (result.type !== "success") throw new Error("Authorization was not successful.");

      const tokens = await AuthSession.exchangeCodeAsync(
        {
          ...createCodeExchangeParams({
            clientId,
            code: result.params.code,
            redirectUri: callbackUri,
            codeVerifier: request.codeVerifier ?? "",
            resource: `${server.replace(/\/$/, "")}/mcp`,
          }),
        },
        discovery,
      );

      if (!tokens.refreshToken) throw new Error("No refresh token was returned.");

      const session = createTokenSet({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      });

      const persisted = await saveTokens(session);

      if (!persisted) throw new Error("A newer session replaced this login.");

      setSession(session);
    } catch {
      onError("Unable to sign in. Check the OAuth settings and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return { signIn, isSubmitting };
}
