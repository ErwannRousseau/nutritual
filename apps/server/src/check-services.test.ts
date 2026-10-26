import { spawnSync } from "node:child_process";
import { expect, test } from "bun:test";

const databaseCheck = new URL("./check-database.ts", import.meta.url).pathname;

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
