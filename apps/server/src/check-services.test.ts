import { spawnSync } from "node:child_process";
import { expect, test } from "bun:test";

const databaseCheck = new URL("./check-database.ts", import.meta.url).pathname;
const authCheck = new URL("./check-auth.ts", import.meta.url).pathname;

test("database check reports missing configuration without secrets", () => {
  const result = spawnSync("bun", ["run", databaseCheck], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "" },
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("DATABASE_URL is not set");
  expect(result.stdout + result.stderr).not.toContain("postgres://");
});

test("database check hides connection details on failure", () => {
  const result = spawnSync("bun", ["run", databaseCheck], {
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: "postgres://private-user:private-password@127.0.0.1:1/private-db",
    },
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("could not query the configured database");
  expect(result.stdout + result.stderr).not.toContain("private-password");
});

test("auth check reports missing configuration without secrets", () => {
  const result = spawnSync("bun", ["run", authCheck], {
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: "",
      BETTER_AUTH_URL: "",
      BETTER_AUTH_SECRET: "",
    },
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("required configuration is not set");
  expect(result.stdout + result.stderr).not.toContain("http://");
});

test("auth check hides connection details on failure", () => {
  const result = spawnSync("bun", ["run", authCheck], {
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: "postgres://private-user:private-password@127.0.0.1:1/private-db",
      BETTER_AUTH_URL: "http://127.0.0.1:1",
      BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
    },
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("could not reach the configured service or database");
  expect(result.stdout + result.stderr).not.toContain("127.0.0.1");
  expect(result.stdout + result.stderr).not.toContain("private-password");
});
