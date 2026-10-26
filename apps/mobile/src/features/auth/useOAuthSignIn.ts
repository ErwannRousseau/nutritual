import { useState } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { saveTokens } from "@/features/auth/session";
import type { TokenSet } from "@/features/auth/session-model";
import { useAuth } from "@/features/auth/AuthProvider";
import { createCodeExchangeParams } from "@/features/auth/oauth";

WebBrowser.maybeCompleteAuthSession();

const issuer = process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL;
const clientId = process.env.EXPO_PUBLIC_MOBILE_OAUTH_CLIENT_ID;
const server = process.env.EXPO_PUBLIC_SERVER_URL;
const callbackUri = server ? `${server.replace(/\/$/, "")}/oauth/mobile/callback` : "";

export function useOAuthSignIn(onError: (message: string) => void) {
  const { setSession } = useAuth();
  const discovery = AuthSession.useAutoDiscovery(issuer ?? "https://invalid.local");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [request] = AuthSession.useAuthRequest(
    {
      clientId: clientId ?? "",
      responseType: AuthSession.ResponseType.Code,
      scopes: ["openid", "offline_access"],
      redirectUri: callbackUri,
      usePKCE: true,
      extraParams: { resource: server ? `${server.replace(/\/$/, "")}/mcp` : "" },
    },
    discovery,
  );

  async function signIn() {
    if (!request || !discovery || !issuer || !clientId || !callbackUri || !server) {
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

      const now = Date.now();

      const session: TokenSet = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? "",
        accessTokenExpiresAt: now + (tokens.expiresIn ?? 3600) * 1000,
        refreshTokenExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
      };

      if (!session.refreshToken) throw new Error("No refresh token was returned.");
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
