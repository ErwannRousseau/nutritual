import { SQL } from "bun";
import { z } from "zod";

const result = z.url().safeParse(process.env.DATABASE_URL);

if (!result.success) {
  console.error("Postgres check failed: DATABASE_URL is not set.");
  process.exitCode = 1;
} else {
  const database = new SQL(result.data, {
    connectionTimeout: 5,
    max: 1,
  });

  try {
    await database`SELECT 1`;
    console.log("Neon Postgres connection succeeded.");
  } catch {
    console.error("Postgres check failed: could not query the configured database.");
    process.exitCode = 1;
  } finally {
    await database.close().catch(() => {
      process.exitCode = 1;
    });
  }
}
