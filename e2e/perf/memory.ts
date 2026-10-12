import type { Browser } from "@playwright/test";

/** One memory-infra dump of one renderer: `at` on our clock, `bytes` = its private footprint. */
export type MemorySample = { at: number; pid: number; bytes: number };

type TraceEvent = { ph: string; name: string; pid: number; ts: number; args?: Record<string, unknown> };

/** NFR-PER-006: Chrome's own memory-infra dumps every 10 s over CDP — the private footprint
 *  Task Manager shows as "Memory footprint", read the same way on H and on a remote G.
 *  Returns `stop()`, which ends the trace and gives every renderer's samples. */
export async function traceMemory(browser: Browser): Promise<{ stop: () => Promise<Array<MemorySample>> }> {
  const cdp = await browser.newBrowserCDPSession();
  const startedAt = Date.now();
  await cdp.send("Tracing.start", {
    traceConfig: {
      includedCategories: ["disabled-by-default-memory-infra"],
      excludedCategories: ["*"],
      // Typed as a string map by the protocol definitions; Chrome reads these nested triggers.
      memoryDumpConfig: { triggers: [{ mode: "light", periodic_interval_ms: 10_000 }] } as unknown as Record<string, string>,
    },
    transferMode: "ReturnAsStream",
  });
  return {
    stop: async () => {
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
      // A renderer started after the trace began is named by its command line, not "Renderer".
      const isRenderer = (name: string) => name === "Renderer" || name.includes("--type=renderer");
      const renderers = new Set(
        events.filter((e) => e.ph === "M" && e.name === "process_name" && isRenderer(String(e.args?.name))).map((e) => e.pid),
      );
      const dumps = events.filter((e) => e.ph === "v" && renderers.has(e.pid));
      const firstTs = Math.min(...dumps.map((e) => e.ts));
      return dumps.flatMap((e) => {
        const totals = (e.args?.dumps as { process_totals?: { private_footprint_bytes?: string } } | undefined)?.process_totals;
        if (!totals?.private_footprint_bytes) return [];
        return [{ at: startedAt + (e.ts - firstTs) / 1000, pid: e.pid, bytes: parseInt(totals.private_footprint_bytes, 16) }];
      });
    },
  };
}
