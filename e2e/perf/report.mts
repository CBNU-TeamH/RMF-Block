import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import * as Plot from "@observablehq/plot";
import { Window } from "happy-dom";

import { readJsonFile } from "../../lib/json-file.ts";
import { account, ecdf, offsetFrom, p95, toH, uncertainty, verdict, type ClockSample, type RoundClock } from "./stats.mts";

/** `pnpm perf:report perf-results/<run-id>`: the run's raw files → `summary.json` and the
 *  markdown table #191 records, plus `summary.html` (charts drawn from the same numbers). Every number follows #189's measurement contracts. A round is
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

/** Per item and direction, every round's sends and receipts on one clock, and the worst U. Markers
 *  are scoped by the round's folder: a replacement round comes from a new run (runbook §9) whose
 *  markers repeat the original rounds' numbers. */
const pooled = new Map<string, { sends: Array<{ marker: string; t0: number }>; recvs: Array<{ marker: string; t1: number }>; u: number }>();
function pool(key: string, round: string, sends: Array<{ marker: string; t0: number }>, recvs: Array<{ marker: string; t1: number }>, u: number) {
  const into = pooled.get(key) ?? { sends: [], recvs: [], u: 0 };
  const scoped = <T extends { marker: string }>(list: Array<T>) => list.map((entry) => ({ ...entry, marker: `${round}/${entry.marker}` }));
  pooled.set(key, { sends: [...into.sends, ...scoped(sends)], recvs: [...into.recvs, ...scoped(recvs)], u: Math.max(into.u, u) });
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
      if (sends.length) pool(`${item} ${from}→${to}`, name, sends, received(to, item, from), u);
    }
  }
  const join = (kind: string) => events.find((e) => e.device === "G" && e.item === "003" && e.kind === kind)?.t;
  const joinRecv = join("recv");
  pool("003 G", name, [{ marker: name, t0: join("send") ?? NaN }], joinRecv === undefined ? [] : [{ marker: name, t1: joinRecv }], 0);

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

const samples = new Map<string, Array<number>>();
const items = [...pooled].map(([key, { sends, recvs, u }]) => {
  const a = account(sends, recvs, TIMEOUT[key.slice(0, 3)]);
  samples.set(key, a.samples);
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
const cells = (r: RoundRow) => [
  r.round,
  r.preset,
  String(r.users),
  r.u === null ? "—" : `${r.u.toFixed(1)} ms`,
  status(r),
  `${r.memoryMiB.H?.toFixed(0) ?? "—"} / ${r.memoryMiB.G?.toFixed(0) ?? "—"}`,
  ms(r.rttMedian),
  r.outage ? outageText(r.outage) : "—",
];
const status = (r: RoundRow) => (r.aborted ? `aborted: ${r.aborted.slice(0, 80)}` : r.failures.length ? r.failures.join(", ") : "0");
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
  ...perRound.map((r) => `| ${cells(r).join(" | ")} |`),
].join("\n");
await writeFile(path.join(run, "summary.md"), md + "\n");
console.log(md);

// summary.html: static SVG rendered here (no script in the page), so it opens offline on H.
const window = new Window();
const plot = (options: Plot.PlotOptions) =>
  (Plot.plot({ document: window.document as unknown as Document, width: 760, ...options }) as unknown as { outerHTML: string }).outerHTML;
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const sections: Array<string> = [];

for (const id of ["002", "003", "004", "005"]) {
  const keys = items.filter((i) => i.key.startsWith(id));
  if (!keys.length) continue;
  const curve = keys.flatMap((i) => ecdf(samples.get(i.key)!).map((point) => ({ ...point, key: i.key })));
  const marks = keys.filter((i) => Number.isFinite(i.p95)).map((i) => ({ key: i.key, ms: i.p95!, share: 0.95 }));
  const budget = BUDGET[id];
  sections.push(`<h2>${id}: latency over attempts</h2>
<p>Share of attempts seen within each latency. The curve stops short of 1 by the timed-out attempts; the red line is the budget, dots mark p95.</p>
${plot({
  x: { label: "latency (ms)", domain: [0, curve.reduce((max, p) => Math.max(max, p.ms), budget * 1.1)] },
  y: { label: "share of attempts", domain: [0, 1], grid: true },
  // The keys, not the curve: an item that timed out every attempt has no points, and an
  // inferred scale then turns continuous, whose legend needs a canvas happy-dom lacks.
  color: { legend: true, domain: keys.map((i) => i.key) },
  marks: [
    Plot.ruleY([0.95], { stroke: "#999", strokeDasharray: "2 3" }),
    Plot.ruleX([budget], { stroke: "red" }),
    Plot.lineY(curve, { x: "ms", y: "share", stroke: "key", curve: "step-after" }),
    Plot.dot(curve, { x: "ms", y: "share", fill: "key", r: 1.5 }),
    Plot.dot(marks, { x: "ms", y: "share", fill: "key", r: 4 }),
  ],
})}`);
}

const judged = items.filter((i) => i.p95 !== null);
if (judged.length) {
  const cap = Math.max(...judged.map((i) => i.budget * 1.2), ...judged.filter((i) => Number.isFinite(i.p95)).map((i) => i.p95! + i.u));
  const rows = judged.map((i) => ({ ...i, shown: Math.min(i.p95!, cap) }));
  sections.push(`<h2>p95 ± U against the budget</h2>
<p>Pass when p95 + U is inside the budget (red tick), fail when p95 − U is outside it. A p95 of ∞ is drawn at the right edge.</p>
${plot({
  marginLeft: 90,
  x: { label: "p95 (ms)", domain: [0, cap] },
  y: { label: null },
  color: { legend: true, domain: ["pass", "inconclusive", "fail"], range: ["#2a9d55", "#e0a400", "#d03030"] },
  marks: [
    Plot.ruleY(rows.filter((d) => Number.isFinite(d.p95)), { y: "key", x1: (d) => Math.max(0, d.shown - d.u), x2: (d) => Math.min(cap, d.shown + d.u) }),
    Plot.tickX(rows, { y: "key", x: "budget", stroke: "red" }),
    Plot.dot(rows, { y: "key", x: "shown", fill: "verdict", r: 5 }),
  ],
})}`);
}

const memory = perRound.flatMap((r) => (["H", "G"] as const).flatMap((device) => (r.memoryMiB[device] === null ? [] : [{ round: r.round, device, mib: r.memoryMiB[device]! }])));
if (memory.length) {
  sections.push(`<h2>NFR-PER-006: memory peak per round</h2>
${plot({
  x: { label: null, type: "point" },
  y: { label: "peak footprint (MiB)", domain: [0, Math.max(MEMORY_BUDGET_MIB * 1.1, ...memory.map((m) => m.mib))], grid: true },
  color: { legend: true },
  marks: [Plot.ruleY([MEMORY_BUDGET_MIB], { stroke: "red" }), Plot.dot(memory, { x: "round", y: "mib", fill: "device", r: 5 })],
})}`);
}

sections.push(`<h2>NFR-PER-001: rounds</h2>
<p>${summary["001"].failedRounds}/${summary["001"].rounds} baseline rounds failed (pass needs 0).</p>
${plot({
  height: 90,
  x: { label: null, type: "band" },
  color: { legend: true, domain: ["ok", "failed"], range: ["#2a9d55", "#d03030"] },
  marks: [Plot.cell(perRound, { x: "round", fill: (r: RoundRow) => (r.aborted || r.failures.length ? "failed" : "ok"), inset: 1 })],
})}
<table><tr><th>Round</th><th>Preset</th><th>Users</th><th>U</th><th>Failures</th><th>Memory H / G (MiB)</th><th>G RTT median</th><th>Outage</th></tr>
${perRound.map((r) => `<tr>${cells(r).map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("\n")}
</table>`);

await writeFile(path.join(run, "summary.html"), `<!doctype html>
<meta charset="utf-8"><title>${esc(path.basename(run))}</title>
<style>body{font:14px system-ui,sans-serif;max-width:800px;margin:24px auto;padding:0 16px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}</style>
<h1>${esc(path.basename(run))}</h1>
${sections.join("\n")}
`);
await window.happyDOM.close();
