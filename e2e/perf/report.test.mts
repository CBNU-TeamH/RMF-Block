import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, it } from "vitest";

describe("perf:report — NFR-PER-003 attempts", () => {
  it("keeps the timed-out join of a round that then aborted", async () => {
    const run = await mkdtemp(path.join(os.tmpdir(), "perf-report-"));
    const round = path.join(run, "round-01");
    await mkdir(round);
    await writeFile(path.join(round, "conditions.json"), JSON.stringify({ preset: "baseline", users: 8, outage: 0 }));
    await writeFile(path.join(round, "signals.jsonl"), [
      { kind: "join-timeout", phase: "setup" },
      { kind: "aborted", phase: "setup", message: "Error: expect(locator).toHaveCount(expected)" },
    ].map((s) => JSON.stringify(s)).join("\n"));
    await promisify(execFile)(process.execPath, ["e2e/perf/report.mts", run]);
    const { items } = JSON.parse(await readFile(path.join(run, "summary.json"), "utf8")) as { items: Array<{ key: string; attempted: number; timedOut: number }> };
    const join = items.find((i) => i.key === "003 G");
    assert.deepEqual(join && { attempted: join.attempted, timedOut: join.timedOut }, { attempted: 1, timedOut: 1 });
  }, 120_000); // a whole report process: loading Plot and happy-dom takes ~50 s on a WSL /mnt/c checkout
});
