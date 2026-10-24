import { expect, test } from "bun:test";

import app from "./index.ts";

test("GET /health returns a successful health response", async () => {
  const response = await app.request("/health");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
