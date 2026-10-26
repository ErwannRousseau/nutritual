import { expect, test } from "bun:test";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from "jose";
import { createBrowserSessionVerifier } from "./browser-session.ts";

test("Neon browser session verifier checks issuer, audience, role, and expiry", async () => {
  const issuer = "https://auth.test.invalid";
  const { privateKey, publicKey } = await generateKeyPair("EdDSA");

  const jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(publicKey)), kid: "test-key", alg: "EdDSA" }],
  });

  const verify = createBrowserSessionVerifier(issuer, jwks);

  const token = await new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(issuer)
    .setSubject("user-a")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(privateKey);

  expect(await verify(token)).toBe("user-a");

  const wrongAudience = await new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience("https://other.invalid")
    .setSubject("user-a")
    .setExpirationTime("2m")
    .sign(privateKey);

  await expect(verify(wrongAudience)).rejects.toThrow();

  const wrongRole = await new SignJWT({ role: "anonymous" })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(issuer)
    .setSubject("user-a")
    .setExpirationTime("2m")
    .sign(privateKey);

  await expect(verify(wrongRole)).rejects.toThrow("authenticated user session");
});
