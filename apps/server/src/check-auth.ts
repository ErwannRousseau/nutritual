export {};

export {};

const authBaseUrl = process.env.NEON_AUTH_BASE_URL;

if (!authBaseUrl) {
  console.error("Neon Auth check failed: NEON_AUTH_BASE_URL is not set.");
  process.exitCode = 1;
} else {
  try {
    const endpoint = new URL("get-session", `${authBaseUrl.replace(/\/+$/, "")}/`);

    const response = await fetch(endpoint, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error("Auth service returned an unsuccessful response.");
    }

    console.log("Neon Auth endpoint is reachable.");
  } catch {
    console.error("Neon Auth check failed: could not reach the configured service.");
    process.exitCode = 1;
  }
}
