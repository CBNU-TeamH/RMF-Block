import type { Browser } from "@playwright/test";

/** One memory-infra dump of one renderer: `bytes` = its private footprint. */
export type MemorySample = { pid: number; bytes: number };

type TraceEvent = { ph: string; pid: number; args?: { dumps?: { process_totals?: { private_footprint_bytes?: string } } } };

/** NFR-PER-006: Chrome's own memory-infra dumps every 10 s over CDP — the private footprint
 *  Task Manager shows as "Memory footprint", read the same way on H and on a remote G.
 *  Returns `stop()`, which ends the trace and gives every live renderer's samples. */
export async function traceMemory(browser: Browser): Promise<{ stop: () => Promise<Array<MemorySample>> }> {
  const cdp = await browser.newBrowserCDPSession();
  await cdp.send("Tracing.start", {
    traceConfig: {
      includedCategories: ["disabled-by-default-memory-infra"],
      excludedCategories: ["*"],
      // Typed as a string map by the protocol definitions; Chrome reads these nested triggers.
      memoryDumpConfig: { triggers: [{ mode: "light", periodic_interval_ms: 10_000 }] } as unknown as Record<string, string>,
    },
    transferMode: "ReturnAsStream",
  }).catch((error: Error) => {
    // A trace belongs to the session that started it; one left by a killed run cannot be ended.
    if (!error.message.includes("already been started")) throw error;
    throw new Error("This browser is still tracing for an interrupted run. Restart it — on G, Ctrl+C and `pnpm perf:browser` again.");
  });
  return {
    stop: async () => {
      // The browser's own process list, not the trace's process names (which change form).
      const { processInfo } = await cdp.send("SystemInfo.getProcessInfo");
      const renderers = new Set(processInfo.filter((p) => p.type === "renderer").map((p) => p.id));
      const complete = new Promise<string>((resolve) => cdp.once("Tracing.tracingComplete", (event) => resolve(event.stream!)));
      await cdp.send("Tracing.end");
      const handle = await complete;
      let text = "";
      for (;;) {
        const chunk = await cdp.send("IO.read", { handle });
        text += chunk.base64Encoded ? Buffer.from(chunk.data, "base64").toString() : chunk.data;
        if (chunk.eof) break;
      }
      await cdp.send("IO.close", { handle });
      await cdp.detach();
      const parsed = JSON.parse(text) as { traceEvents?: Array<TraceEvent> } | Array<TraceEvent>;
      const events = Array.isArray(parsed) ? parsed : (parsed.traceEvents ?? []);
      return events.flatMap((e) => {
        const bytes = e.args?.dumps?.process_totals?.private_footprint_bytes;
        return e.ph === "v" && renderers.has(e.pid) && bytes ? [{ pid: e.pid, bytes: parseInt(bytes, 16) }] : [];
      });
    },
  };
}
