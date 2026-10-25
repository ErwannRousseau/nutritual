export {};

const requiredConfiguration = [
  process.env.DATABASE_URL,
  process.env.BETTER_AUTH_URL,
  process.env.BETTER_AUTH_SECRET,
];

if (requiredConfiguration.some((value) => !value)) {
  console.error("Better Auth check failed: required configuration is not set.");
  process.exitCode = 1;
} else {
  const { auth, database } = await import("./auth.ts");

  try {
    await database.query("SELECT 1");

    const response = await auth.handler(
      new Request(new URL("/api/auth/get-session", process.env.BETTER_AUTH_URL)),
    );

    if (!response.ok) throw new Error();

    console.log("Better Auth handler and Postgres are reachable.");
  } catch {
    console.error("Better Auth check failed: could not reach the configured service or database.");
    process.exitCode = 1;
  } finally {
    await database.end().catch(() => {
      process.exitCode = 1;
    });
  }
}
