import { defineConfig, devices } from "@playwright/test";

/**
 * The E2E layer (`docs/testing.md`). It drives a stack that is already running —
 * the container (`pnpm docker:up`) or `pnpm dev` beside a Yorkie container — so
 * there is no `webServer` here. `.e2e.ts`, not `.spec.ts`: Vitest's default glob
 * would collect a `.spec.ts` file as one of its own.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  // One stack, shared state (members, documents): tests run one after another.
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
