import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export function createBrowserSessionVerifier(authBaseUrl: string, getKey?: JWTVerifyGetKey) {
  const authOrigin = new URL(authBaseUrl).origin;
  const jwksUrl = new URL(`${authBaseUrl.replace(/\/+$/, "")}/.well-known/jwks.json`);
  const jwks = getKey ?? createRemoteJWKSet(jwksUrl);

  return async (token: string): Promise<string> => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: authOrigin,
      audience: authOrigin,
      algorithms: ["EdDSA"],
      requiredClaims: ["sub", "exp"],
    });

    if (payload.role !== "authenticated" || !payload.sub || payload.sub.length === 0) {
      throw new Error("The Neon browser session is not an authenticated user session.");
    }

    return payload.sub;
  };
}
