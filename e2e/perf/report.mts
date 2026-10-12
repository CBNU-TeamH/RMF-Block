import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { account, offsetFrom, p95, toH, uncertainty, verdict, type Accounting, type ClockSample, type RoundClock } from "./stats.mts";

/** `pnpm perf:report perf-results/<run-id>`: the run's raw files → `summary.json` and the
 *  markdown table #191 records. Every number follows #189's measurement contracts. */
const run = process.argv[2];
if (!run) throw new Error("usage: pnpm perf:report perf-results/<run-id>");

const BUDGET: Record<string, number> = { "002": 1000, "003": 3000, "004": 1000, "005": 1000 };
const TIMEOUT: Record<string, number> = { "002": 10_000, "003": 30_000, "004": 10_000, "005": 10_000 };
const MEMORY_BUDGET_MIB = 500;
/** NFR-PER-001's failure signals; outside the measured window only a join timeout counts. */
const FAILURES = new Set(["http", "ws-close", "watch-end", "page-error", "action-error", "no-convergence", "edit-count", "chat-count", "badge", "join-timeout"]);

type Event = { device: "H" | "G"; kind: string; item: string; marker: string; t: number };
type Plan = { item: string; marker: string; from: string; outage?: boolean; resend?: boolean };
type Signal = { at: number; who: string; kind: string };
type Device = "H" | "G";

async function rows<T>(file: string): Promise<Array<T>> {
  try {
    return (await readFile(file, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
async function json<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

const pooled = new Map<string, Accounting & { u: number }>();
function pool(key: string, a: Accounting, u: number) {
  const into = pooled.get(key) ?? { attempted: 0, observed: 0, timedOut: 0, unmatched: 0, duplicate: 0, samples: [], u: 0 };
  pooled.set(key, {
    attempted: into.attempted + a.attempted,
    observed: into.observed + a.observed,
    timedOut: into.timedOut + a.timedOut,
    unmatched: into.unmatched + a.unmatched,
    duplicate: into.duplicate + a.duplicate,
    samples: [...into.samples, ...a.samples],
    u: Math.max(into.u, u),
  });
}

const ms = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : Number.isFinite(value) ? `${Math.round(value)} ms` : "∞";
const rounds = (await readdir(run)).filter((name) => name.startsWith("round-")).sort();
const perRound = [];

for (const name of rounds) {
  const dir = path.join(run, name);
  const conditions = await json<{ preset: string; users: number; outage: number }>(path.join(dir, "conditions.json"));
  const signals = await rows<Signal>(path.join(dir, "signals.jsonl"));
  if (!conditions) {
    perRound.push({ round: name, incomplete: true, signals: signals.length });
    continue;
  }
  const raw = (await json<Record<"start" | "end", Record<Device, Array<ClockSample>>>>(path.join(dir, "clock.json")))!;
  const clocks: Record<Device, RoundClock> = {
    H: { start: offsetFrom(raw.start.H), end: offsetFrom(raw.end.H) },
    G: { start: offsetFrom(raw.start.G), end: offsetFrom(raw.end.G) },
  };
  const u = uncertainty(clocks.H) + uncertainty(clocks.G);
  const onH = (device: Device, t: number) => toH(clocks[device], t);
  const events = await rows<Event>(path.join(dir, "events.jsonl"));
  const plan = await rows<Plan>(path.join(dir, "plan.jsonl"));
  const meta = (await json<Record<string, number | boolean | null>>(path.join(dir, "meta.json")))!;
  const received = (to: Device, item: string, from: string) =>
    events
      .filter((e) => e.device === to && e.kind === "recv" && e.item === item && e.marker.split(":")[2] === from)
      .map((e) => ({ marker: e.marker, t1: onH(to, e.t) }));

  for (const item of ["002", "004", "005"]) {
    for (const [from, to] of [["H", "G"], ["G", "H"]] as const) {
      const sent = new Map(events.filter((e) => e.device === from && e.kind === "send" && e.item === item).map((e) => [e.marker, onH(from, e.t)]));
      const sends = plan
        .filter((p) => p.item === item && p.from === from && !p.outage)
        .map((p) => ({ marker: p.marker, t0: sent.get(p.marker) ?? NaN }));
      if (sends.length) pool(`${item} ${from}→${to}`, account(sends, received(to, item, from), TIMEOUT[item]), u);
    }
  }
  const join = (kind: string) => events.find((e) => e.device === "G" && e.item === "003" && e.kind === kind)?.t;
  const joinRecv = join("recv");
  pool("003 G", account([{ marker: "join", t0: join("send") ?? NaN }], joinRecv === undefined ? [] : [{ marker: "join", t1: joinRecv }], TIMEOUT["003"]), 0);

  const failures = signals.filter((s) =>
    FAILURES.has(s.kind) && (s.kind === "join-timeout" || (s.at >= (meta.windowStart as number) && s.at <= (meta.windowEnd as number))));
  const memory = await rows<{ device: Device; pid: number; bytes: number }>(path.join(dir, "memory.jsonl"));
  const peak = (device: Device) => {
    const byPid = new Map<number, number>();
    for (const s of memory.filter((m) => m.device === device)) byPid.set(s.pid, Math.max(byPid.get(s.pid) ?? 0, s.bytes));
    return byPid.size ? Math.max(...byPid.values()) / 2 ** 20 : null;
  };
  let outage = null;
  if (typeof meta.restoreAt === "number") {
    const restoreAt = meta.restoreAt;
    const latest = (list: Array<{ t1: number }>, expected: number) =>
      list.length < expected ? Infinity : Math.max(...list.map((r) => r.t1)) - restoreAt;
    const outageMarkers = (from: string, kind: string) => new Set(plan.filter((p) => p.outage && p.from === from && p.marker.split(":")[3] === kind && !p.resend).map((p) => p.marker));
    const of = (list: Array<{ marker: string; t1: number }>, markers: Set<string>) => list.filter((r) => markers.has(r.marker));
    const resendMarker = plan.find((p) => p.resend)?.marker;
    const resent = received("H", "004", "G").find((r) => r.marker === resendMarker);
    outage = {
      documentResync: Math.max(
        latest(of(received("G", "002", "H"), outageMarkers("H", "o")), 2),
        latest(of(received("H", "002", "G"), outageMarkers("G", "o")), 2),
      ),
      chatBackfill: latest(of(received("G", "004", "H"), outageMarkers("H", "c")), 2),
      chatReopen: typeof meta.chatReopenAt === "number" ? meta.chatReopenAt - restoreAt : null,
      sessionReopen: typeof meta.sessionReopenAt === "number" ? meta.sessionReopenAt - restoreAt : null,
      failedShown: meta.failedShown,
      resendDelivered: resent && typeof meta.resendAt === "number" ? resent.t1 - meta.resendAt : null,
    };
  }
  const rtt = ((await json<Array<number>>(path.join(dir, "rtt.json"))) ?? []).sort((a, b) => a - b);
  perRound.push({
    round: name,
    preset: conditions.preset,
    users: conditions.users,
    u,
    failures: failures.length,
    failureKinds: [...new Set(failures.map((f) => f.kind))],
    memoryMiB: { H: peak("H"), G: peak("G") },
    rttMs: rtt.length ? { min: rtt[0], median: rtt[Math.floor(rtt.length / 2)], max: rtt.at(-1) } : null,
    outage,
  });
}

const items = [...pooled].map(([key, a]) => {
  const item = key.slice(0, 3);
  const value = p95(a.samples);
  return {
    key,
    attempted: a.attempted,
    observed: a.observed,
    timedOut: a.timedOut,
    unmatchedOrDuplicate: a.unmatched + a.duplicate,
    p95: value,
    u: a.u,
    budget: BUDGET[item],
    verdict: value === null ? "n<20" : verdict(value, a.u, BUDGET[item]),
  };
});
const complete = perRound.filter((r) => !("incomplete" in r));
const baseline = complete.filter((r) => "outage" in r && r.outage === null);
const summary = {
  run,
  rounds: perRound,
  items,
  "001": { rounds: baseline.length, failedRounds: baseline.filter((r) => "failures" in r && (r.failures ?? 0) > 0).length },
  "006": complete.map((r) => ({ round: r.round, ...("memoryMiB" in r ? r.memoryMiB : {}) })),
};
await writeFile(path.join(run, "summary.json"), JSON.stringify(summary, null, 2));

const md = [
  `# ${path.basename(run)}`,
  "",
  "| Item | Attempted | Observed | Timed-out | Unmatched / dup | p95 (nearest-rank) | U | Budget | Verdict |",
  "|---|---|---|---|---|---|---|---|---|",
  ...items.map((i) => `| ${i.key} | ${i.attempted} | ${i.observed} | ${i.timedOut} | ${i.unmatchedOrDuplicate} | ${ms(i.p95)} | ${i.u.toFixed(1)} ms | ${i.budget} ms | ${i.verdict} |`),
  "",
  `NFR-PER-001: ${summary["001"].failedRounds}/${summary["001"].rounds} baseline rounds with a failure signal (pass needs 0).`,
  "",
  "| Round | Preset | Users | U | Failures | Memory H / G (MiB, budget " + MEMORY_BUDGET_MIB + ") | G RTT median | Outage |",
  "|---|---|---|---|---|---|---|---|",
  ...perRound.map((r) => "incomplete" in r
    ? `| ${r.round} | incomplete | | | ${r.signals} signals | | | |`
    : `| ${r.round} | ${r.preset} | ${r.users} | ${r.u.toFixed(1)} ms | ${r.failures}${r.failureKinds.length ? ` (${r.failureKinds.join(", ")})` : ""} | ${r.memoryMiB.H?.toFixed(0) ?? "—"} / ${r.memoryMiB.G?.toFixed(0) ?? "—"} | ${ms(r.rttMs?.median)} | ${r.outage
      ? `doc ${ms(r.outage.documentResync)}, chat ${ms(r.outage.chatBackfill)}, chat socket ${ms(r.outage.chatReopen)}, session ${ms(r.outage.sessionReopen)}, failed shown ${r.outage.failedShown}, resend ${ms(r.outage.resendDelivered)}`
      : "—"} |`),
].join("\n");
await writeFile(path.join(run, "summary.md"), md + "\n");
console.log(md);
