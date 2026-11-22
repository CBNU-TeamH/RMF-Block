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
  // The lifecycle specs restart and kill the stack they run against, so they get a stack of their
  // own (`pnpm e2e:isolated --lifecycle`) and are not a project of an ordinary run.
  //
  // Firefox, WebKit and Edge (NFR-USA-005) are opt-in — `E2E_BROWSERS=all`, then `--project=firefox`,
  // `--project=webkit` or `--project=msedge` — so CI and a plain `pnpm e2e` stay Chromium-only. WebKit is
  // Playwright's build of the engine Safari uses, not Safari; `msedge` is the installed Edge itself.
  projects: process.env.E2E_LIFECYCLE
    ? [{ name: "lifecycle", testMatch: "**/lifecycle/*.e2e.ts", use: { ...devices["Desktop Chrome"] } }]
    : [
        { name: "chromium", testIgnore: "**/lifecycle/**", use: { ...devices["Desktop Chrome"] } },
        ...(process.env.E2E_BROWSERS === "all"
          ? [
              { name: "firefox", testIgnore: "**/lifecycle/**", use: { ...devices["Desktop Firefox"] } },
              { name: "webkit", testIgnore: "**/lifecycle/**", use: { ...devices["Desktop Safari"] } },
              { name: "msedge", testIgnore: "**/lifecycle/**", use: { ...devices["Desktop Edge"], channel: "msedge" } },
            ]
          : []),
      ],
});
