import { randomUUID } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13).toLowerCase();
process.env.PERF_RUN_ID ??= `${stamp}-${randomUUID().slice(0, 4)}`;
process.env.E2E_RUN_ID ??= "perf"; // background nicknames `e2e-perf-<slot>`: under the 20-character limit, and unique per fresh stack
process.env.E2E_WORKSPACE_PASSWORD ??= `perf-${randomUUID()}`;

/** The performance harness (`docs/perf/runbook-ko.md`): one test per round against a stack it
 *  starts itself, run by hand on the measurement rig — never by `pnpm e2e` or CI. The default
 *  browser here is the headless one the background users share. */
export default defineConfig({
  testDir: "e2e/perf",
  testMatch: "**/*.perf.ts",
  outputDir: "perf-results/test-results",
  workers: 1,
  retries: 0,
  timeout: 40 * 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://${process.env.HOST_LAN_IP ?? "127.0.0.1"}:${process.env.PERF_APP_PORT ?? "3000"}`,
    trace: "off",
  },
  projects: [{ name: "perf", use: { ...devices["Desktop Chrome"] } }],
});
