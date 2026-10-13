import { chromium } from "@playwright/test";

import { lanAddresses } from "../../lib/lan-address.ts";
import { measuringLaunch } from "./probe.ts";

/** Runs on G: G's measuring Chrome as a browser server the harness on H drives (`pnpm perf`,
 *  `PERF_G_WS`). Anyone who can reach the port can drive this browser — stop it after the run. */
const port = Number(process.env.PERF_BROWSER_PORT ?? 9333);
const host = process.env.PERF_BROWSER_HOST ?? "0.0.0.0";
const server = await chromium.launchServer({ ...measuringLaunch(), host, port });
const { pathname } = new URL(server.wsEndpoint());
const candidates = host === "0.0.0.0" ? lanAddresses() : [host];
const addresses = candidates.map((address) => `  PERF_G_WS=ws://${address}:${port}${pathname}`);
console.log(`G's browser server is up. Give H the line for G's address on the measurement network:\n${addresses.join("\n")}`);
console.log("Do not touch its window. Ctrl+C stops it.");
process.on("SIGINT", () => void server.close().then(() => process.exit(0)));
