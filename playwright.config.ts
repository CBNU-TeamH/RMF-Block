import { randomUUID } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

process.env.E2E_RUN_ID ??= randomUUID().slice(0, 8);

/**
 * The E2E layer (`docs/testing.md`). It drives a stack that is already running —
 * a disposable container, optionally managed by `pnpm e2e:isolated` — so
 * there is no `webServer` here. `.e2e.ts`, not `.spec.ts`: Vitest's default glob
 * would collect a `.spec.ts` file as one of its own.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  // One stack, shared state (members, documents): tests run one after another.
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: process.env.E2E_JSON_REPORT ?? "e2e-artifacts/results.json" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
