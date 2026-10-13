import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { readJsonFile } from "../../lib/json-file.ts";
import { account, offsetFrom, p95, toH, uncertainty, verdict, type ClockSample, type RoundClock } from "./stats.mts";

/** `pnpm perf:report perf-results/<run-id>`: the run's raw files → `summary.json` and the
 *  markdown table #191 records. Every number follows #189's measurement contracts. A round is
 *  left out only when its folder is renamed `void-round-NN`; an aborted one counts as failed. */
const run = process.argv[2];
if (!run) throw new Error("usage: pnpm perf:report perf-results/<run-id>");

const BUDGET: Record<string, number> = { "002": 1000, "003": 3000, "004": 1000, "005": 1000 };
const TIMEOUT: Record<string, number> = { "002": 10_000, "003": 30_000, "004": 10_000, "005": 10_000 };
const MEMORY_BUDGET_MIB = 500;
/** Browser noise outside the measured window (navigation, the outage cut, teardown) is not a failure. */
const PASSIVE = new Set(["http", "ws-close", "watch-end", "page-error"]);

type Device = "H" | "G";
type Event = { device: Device; kind: string; item: string; marker: string; t: number };
type Plan = { item: string; marker: string; from: string; phase?: "outage" | "resend" };
type Signal = { kind: string; phase: string; message?: string };
type Meta = Partial<Record<"cutAt" | "restoreAt" | "resendAt" | "chatReopenAt" | "sessionReopenAt", number | null>> & { failedShown?: boolean };

async function rows<T>(file: string): Promise<Array<T>> {
  const text: string = await readFile(file, "utf8").catch((error) => (error.code === "ENOENT" ? "" : Promise.reject(error)));
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as T);
}
const json = <T,>(file: string) => readJsonFile<T | null>(file, null);
const ms = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : Number.isFinite(value) ? `${Math.round(value)} ms` : "∞";

/** Per item and direction, every round's sends and receipts on one clock, and the worst U. */
const pooled = new Map<string, { sends: Array<{ marker: string; t0: number }>; recvs: Array<{ marker: string; t1: number }>; u: number }>();
function pool(key: string, sends: Array<{ marker: string; t0: number }>, recvs: Array<{ marker: string; t1: number }>, u: number) {
  const into = pooled.get(key) ?? { sends: [], recvs: [], u: 0 };
  pooled.set(key, { sends: [...into.sends, ...sends], recvs: [...into.recvs, ...recvs], u: Math.max(into.u, u) });
}

type RoundRow = {
  round: string;
  preset: string;
  users: number;
  outageRound: boolean;
  aborted: string | null;
  u: number | null;
  failures: Array<string>;
  memoryMiB: Record<Device, number | null>;
  rttMedian: number | null;
  outage: Record<string, number | boolean | null | undefined> | null;
};
const perRound: Array<RoundRow> = [];

for (const name of (await readdir(run)).filter((n) => n.startsWith("round-")).sort()) {
  const dir = path.join(run, name);
  const conditions = json<{ preset: string; users: number; outage: number }>(path.join(dir, "conditions.json"));
  const signals = await rows<Signal>(path.join(dir, "signals.jsonl"));
  const raw = json<Record<"start" | "end", Record<Device, Array<ClockSample>>>>(path.join(dir, "clock.json"));
  const abort = signals.find((s) => s.kind === "aborted");
  const failures = signals.filter((s) => !PASSIVE.has(s.kind) || s.phase === "window").map((s) => s.kind);
  const row: RoundRow = {
    round: name,
    preset: conditions?.preset ?? "?",
    users: conditions?.users ?? 0,
    outageRound: Boolean(conditions?.outage),
    aborted: abort ? (abort.message ?? "aborted") : raw ? null : "no clock.json",
    u: null,
    failures: [...new Set(failures)],
    memoryMiB: { H: null, G: null },
    rttMedian: null,
    outage: null,
  };
  perRound.push(row);
  if (!raw || abort) continue;

  const clocks: Record<Device, RoundClock> = {
    H: { start: offsetFrom(raw.start.H), end: offsetFrom(raw.end.H) },
    G: { start: offsetFrom(raw.start.G), end: offsetFrom(raw.end.G) },
  };
  const u = uncertainty(clocks.H) + uncertainty(clocks.G);
  row.u = u;
  const onH = (device: Device, t: number) => toH(clocks[device], t);
  const events = await rows<Event>(path.join(dir, "events.jsonl"));
  const plan = await rows<Plan>(path.join(dir, "plan.jsonl"));
  const meta = json<Meta>(path.join(dir, "meta.json")) ?? {};
  const received = (to: Device, item: string, from: string) =>
    events
      .filter((e) => e.device === to && e.kind === "recv" && e.item === item && e.marker.split(":")[2] === from)
      .map((e) => ({ marker: e.marker, t1: onH(to, e.t) }));

  for (const item of ["002", "004", "005"]) {
    for (const [from, to] of [["H", "G"], ["G", "H"]] as const) {
      const sent = new Map(events.filter((e) => e.device === from && e.kind === "send" && e.item === item).map((e) => [e.marker, onH(from, e.t)]));
      const sends = plan.filter((p) => p.item === item && p.from === from && !p.phase).map((p) => ({ marker: p.marker, t0: sent.get(p.marker) ?? NaN }));
      if (sends.length) pool(`${item} ${from}→${to}`, sends, received(to, item, from), u);
    }
  }
  const join = (kind: string) => events.find((e) => e.device === "G" && e.item === "003" && e.kind === kind)?.t;
  const joinRecv = join("recv");
  pool("003 G", [{ marker: name, t0: join("send") ?? NaN }], joinRecv === undefined ? [] : [{ marker: name, t1: joinRecv }], 0);

  const memory = await rows<{ device: Device; pid: number; bytes: number }>(path.join(dir, "memory.jsonl"));
  for (const device of ["H", "G"] as const) {
    const peaks = new Map<number, number>();
    for (const s of memory.filter((m) => m.device === device)) peaks.set(s.pid, Math.max(peaks.get(s.pid) ?? 0, s.bytes));
    row.memoryMiB[device] = peaks.size ? Math.max(...peaks.values()) / 2 ** 20 : null;
  }
  const rtt = (json<Array<number>>(path.join(dir, "rtt.json")) ?? []).sort((a, b) => a - b);
  row.rttMedian = rtt.length ? rtt[Math.floor(rtt.length / 2)] : null;

  if (typeof meta.restoreAt === "number") {
    const restoreAt = meta.restoreAt;
    const cut = (from: string, item: string) => new Set(plan.filter((p) => p.phase === "outage" && p.from === from && p.item === item).map((p) => p.marker));
    const latest = (list: Array<{ marker: string; t1: number }>, markers: Set<string>) => {
      const hits = list.filter((r) => markers.has(r.marker));
      return hits.length < markers.size ? Infinity : Math.max(...hits.map((r) => r.t1)) - restoreAt;
    };
    const resend = plan.find((p) => p.phase === "resend")?.marker;
    const resent = received("H", "004", "G").find((r) => r.marker === resend);
    row.outage = {
      documentResync: Math.max(latest(received("G", "002", "H"), cut("H", "002")), latest(received("H", "002", "G"), cut("G", "002"))),
      chatBackfill: latest(received("G", "004", "H"), cut("H", "004")),
      chatReopen: typeof meta.chatReopenAt === "number" ? meta.chatReopenAt - restoreAt : null,
      sessionReopen: typeof meta.sessionReopenAt === "number" ? meta.sessionReopenAt - restoreAt : null,
      failedShown: meta.failedShown,
      resendDelivered: resent && typeof meta.resendAt === "number" ? resent.t1 - meta.resendAt : null,
    };
  }
}

const items = [...pooled].map(([key, { sends, recvs, u }]) => {
  const a = account(sends, recvs, TIMEOUT[key.slice(0, 3)]);
  const value = p95(a.samples);
  const budget = BUDGET[key.slice(0, 3)];
  return {
    key,
    attempted: a.attempted,
    observed: a.observed,
    timedOut: a.timedOut,
    unmatchedOrDuplicate: a.unmatched + a.duplicate,
    p95: value,
    u,
    budget,
    verdict: value === null ? "n<20" : verdict(value, u, budget),
  };
});
const baseline = perRound.filter((r) => !r.outageRound);
const summary = {
  run,
  rounds: perRound,
  items,
  "001": { rounds: baseline.length, failedRounds: baseline.filter((r) => r.aborted || r.failures.length).length },
};
await writeFile(path.join(run, "summary.json"), JSON.stringify(summary, null, 2));

const outageText = (o: NonNullable<RoundRow["outage"]>) =>
  `doc ${ms(o.documentResync as number)}, chat ${ms(o.chatBackfill as number)}, chat socket ${ms(o.chatReopen as number | null)}, session ${ms(o.sessionReopen as number | null)}, failed shown ${o.failedShown}, resend ${ms(o.resendDelivered as number | null)}`;
const md = [
  `# ${path.basename(run)}`,
  "",
  "| Item | Attempted | Observed | Timed-out | Unmatched / dup | p95 (nearest-rank) | U | Budget | Verdict |",
  "|---|---|---|---|---|---|---|---|---|",
  ...items.map((i) => `| ${i.key} | ${i.attempted} | ${i.observed} | ${i.timedOut} | ${i.unmatchedOrDuplicate} | ${ms(i.p95)} | ${i.u.toFixed(1)} ms | ${i.budget} ms | ${i.verdict} |`),
  "",
  `NFR-PER-001: ${summary["001"].failedRounds}/${summary["001"].rounds} baseline rounds failed (a failure signal or an aborted round; pass needs 0). Rename a round \`void-round-NN\` only after deciding it was not the product's fault.`,
  "",
  `| Round | Preset | Users | U | Failures | Memory H / G (MiB, budget ${MEMORY_BUDGET_MIB}) | G RTT median | Outage |`,
  "|---|---|---|---|---|---|---|---|",
  ...perRound.map((r) => `| ${r.round} | ${r.preset} | ${r.users} | ${r.u === null ? "—" : `${r.u.toFixed(1)} ms`} | ${r.aborted ? `aborted: ${r.aborted.slice(0, 80)}` : r.failures.length ? r.failures.join(", ") : "0"} | ${r.memoryMiB.H?.toFixed(0) ?? "—"} / ${r.memoryMiB.G?.toFixed(0) ?? "—"} | ${ms(r.rttMedian)} | ${r.outage ? outageText(r.outage) : "—"} |`),
].join("\n");
await writeFile(path.join(run, "summary.md"), md + "\n");
console.log(md);
