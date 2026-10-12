import os from "node:os";

import { chromium } from "@playwright/test";

/** Runs on G: G's measuring Chrome as a browser server the harness on H drives (`pnpm perf`,
 *  `PERF_G_WS`). Anyone who can reach the port can drive this browser — stop it after the run. */
const channel = process.env.PERF_CHANNEL ?? "chrome";
const port = Number(process.env.PERF_BROWSER_PORT ?? 9333);
const server = await chromium.launchServer({
  channel: channel === "bundled" ? undefined : channel,
  headless: process.env.PERF_HEADED === "0",
  host: process.env.PERF_BROWSER_HOST ?? "0.0.0.0",
  port,
});
const host = process.env.PERF_BROWSER_HOST ?? "0.0.0.0";
const { pathname } = new URL(server.wsEndpoint());
const candidates = host === "0.0.0.0"
  ? Object.values(os.networkInterfaces()).flat().filter((a) => a?.family === "IPv4" && !a.internal).map((a) => a!.address)
  : [host];
const addresses = candidates.map((address) => `  PERF_G_WS=ws://${address}:${port}${pathname}`);
console.log(`G's browser server is up. Give H the line for G's address on the measurement network:\n${addresses.join("\n")}`);
console.log("Do not touch its window. Ctrl+C stops it.");
process.on("SIGINT", () => void server.close().then(() => process.exit(0)));
