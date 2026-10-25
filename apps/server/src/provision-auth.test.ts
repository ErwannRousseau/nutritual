import { spawnSync } from "node:child_process";
import { expect, test } from "bun:test";

const script = new URL("./provision-auth.ts", import.meta.url).pathname;

test("auth provisioning requires temporary credentials without revealing them", () => {
  const email = "private@example.invalid";
  const password = "private-test-password";

  const result = spawnSync("bun", ["run", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      AUTH_PROVISION_EMAIL: "",
      AUTH_PROVISION_PASSWORD: "",
      BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:3000",
      DATABASE_URL: "postgres://test:test@127.0.0.1:1/test",
    },
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("temporary account credentials are not set");
  expect(result.stdout + result.stderr).not.toContain(email);
  expect(result.stdout + result.stderr).not.toContain(password);
});

test("auth provisioning hides database errors and credentials", () => {
  const email = "private@example.invalid";
  const password = "private-test-password";

  const result = spawnSync("bun", ["run", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      AUTH_PROVISION_EMAIL: email,
      AUTH_PROVISION_PASSWORD: password,
      BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:3000",
      DATABASE_URL: "postgres://private-user:private-db-password@127.0.0.1:1/private-db",
    },
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("account could not be created");
  expect(result.stdout + result.stderr).not.toContain(email);
  expect(result.stdout + result.stderr).not.toContain(password);
  expect(result.stdout + result.stderr).not.toContain("private-db-password");
});
