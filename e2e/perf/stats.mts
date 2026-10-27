/** The perf harness's arithmetic — #189's measurement contracts, kept pure so they can be tested
 *  at their boundaries (`docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`). */

/** One reading of a page's clock: our clock before the call, the page's, ours after. */
export type ClockSample = { sent: number; page: number; received: number };
/** A clock offset: `theta` = their clock − ours at time `at`, good to ±`u`. */
export type Offset = { at: number; theta: number; u: number };
/** A round's clock readings in time order: start, any taken mid-round, end. */
export type RoundClock = Array<Offset>;
export type Verdict = "pass" | "fail" | "inconclusive";

/** Cristian's estimate from the sample with the shortest round trip. */
export function offsetFrom(samples: Array<ClockSample>): Offset {
  const best = samples.reduce((a, b) => (b.received - b.sent < a.received - a.sent ? b : a));
  const mid = (best.sent + best.received) / 2;
  return { at: mid, theta: best.page - mid, u: (best.received - best.sent) / 2 };
}

/** The least-squares line through the readings, θ as a function of time. */
function line(clock: RoundClock): (t: number) => number {
  const meanAt = clock.reduce((sum, r) => sum + r.at, 0) / clock.length;
  const meanTheta = clock.reduce((sum, r) => sum + r.theta, 0) / clock.length;
  const spread = clock.reduce((sum, r) => sum + (r.at - meanAt) ** 2, 0);
  const slope = spread === 0 ? 0 : clock.reduce((sum, r) => sum + (r.at - meanAt) * (r.theta - meanTheta), 0) / spread;
  return (t) => meanTheta + slope * (t - meanAt);
}

/** A round's uncertainty U: the worse bound plus how far any reading sits off the line θ is
 *  corrected along. Two readings fix that line exactly and show nothing, so there the whole drift
 *  counts instead — the rule before mid-round readings (#215). */
export function uncertainty(clock: RoundClock): number {
  const bound = Math.max(...clock.map((r) => r.u));
  if (clock.length < 3) return bound + Math.abs(clock[clock.length - 1].theta - clock[0].theta);
  const fit = line(clock);
  return bound + Math.max(...clock.map((r) => Math.abs(r.theta - fit(r.at))));
}

/** θ at time `t`, on the line through the readings and held flat outside them. */
export function thetaAt(clock: RoundClock, t: number): number {
  return line(clock)(Math.min(Math.max(t, clock[0].at), clock[clock.length - 1].at));
}

/** A G timestamp on H's clock. */
export function toH(clock: RoundClock, gTime: number): number {
  return gTime - thetaAt(clock, gTime);
}

/** Nearest-rank p95 over every attempt (a timed-out one is `Infinity`); `null` under 20. */
export function p95(samples: Array<number>): number | null {
  if (samples.length < 20) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

/** Pass only if the worst case is inside the budget, fail only if the best case is outside. */
export function verdict(p: number, u: number, budget: number): Verdict {
  if (p + u <= budget) return "pass";
  if (p - u > budget) return "fail";
  return "inconclusive";
}

export type Accounting = {
  attempted: number;
  observed: number;
  timedOut: number;
  unmatched: number;
  duplicate: number;
  /** One latency per attempt, `Infinity` where it was never seen within the timeout. */
  samples: Array<number>;
};

/** Pairs sends with receipts by marker, on one clock. A send whose t0 was never seen (`NaN`)
 *  counts as timed out, like one never received. */
export function account(
  sends: Array<{ marker: string; t0: number }>,
  recvs: Array<{ marker: string; t1: number }>,
  timeoutMs: number,
): Accounting {
  const first = new Map<string, number>();
  let duplicate = 0;
  for (const { marker, t1 } of recvs) {
    if (first.has(marker)) duplicate++;
    else first.set(marker, t1);
  }
  const sent = new Set(sends.map((s) => s.marker));
  const unmatched = [...first.keys()].filter((marker) => !sent.has(marker)).length;
  const samples = sends.map(({ marker, t0 }) => {
    const t1 = first.get(marker);
    return t1 !== undefined && t1 - t0 <= timeoutMs ? t1 - t0 : Infinity;
  });
  const timedOut = samples.filter((s) => s === Infinity).length;
  return { attempted: sends.length, observed: sends.length - timedOut, timedOut, unmatched, duplicate, samples };
}

/** A round's NFR-PER-003 attempt: G's join from its events, or a timed-out one from the
 *  `join-timeout` signal of a round that aborted before writing events (#238). `null` when G
 *  never tried to join. */
export function joinAttempt(
  events: Array<{ device: string; item: string; kind: string; t: number }>,
  signals: Array<{ kind: string }>,
): { t0: number; t1?: number } | null {
  const at = (kind: string) => events.find((e) => e.device === "G" && e.item === "003" && e.kind === kind)?.t;
  const t0 = at("send");
  if (t0 === undefined && !signals.some((s) => s.kind === "join-timeout")) return null;
  return { t0: t0 ?? NaN, t1: at("recv") };
}

/** The ECDF over attempts, finite samples only: each step is its rank over every attempt, so a
 *  timed-out attempt never appears yet still holds the curve below 1 (the gap is the time-outs). */
export function ecdf(samples: Array<number>): Array<{ ms: number; share: number }> {
  return samples
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .map((ms, i) => ({ ms, share: (i + 1) / samples.length }));
}
