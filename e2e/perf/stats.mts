/** The perf harness's arithmetic — #189's measurement contracts, kept pure so they can be tested
 *  at their boundaries (`docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`). */

/** One reading of a page's clock: our clock before the call, the page's, ours after. */
export type ClockSample = { sent: number; page: number; received: number };
/** A clock offset: `theta` = their clock − ours at time `at`, good to ±`u`. */
export type Offset = { at: number; theta: number; u: number };
export type RoundClock = { start: Offset; end: Offset };
export type Verdict = "pass" | "fail" | "inconclusive";

/** Cristian's estimate from the sample with the shortest round trip. */
export function offsetFrom(samples: Array<ClockSample>): Offset {
  const best = samples.reduce((a, b) => (b.received - b.sent < a.received - a.sent ? b : a));
  const mid = (best.sent + best.received) / 2;
  return { at: mid, theta: best.page - mid, u: (best.received - best.sent) / 2 };
}

/** A round's uncertainty U: the worse bound plus how far the offset drifted. */
export function uncertainty({ start, end }: RoundClock): number {
  return Math.max(start.u, end.u) + Math.abs(end.theta - start.theta);
}

/** θ at time `t`, linear between the round's two readings and held flat outside them. */
export function thetaAt({ start, end }: RoundClock, t: number): number {
  if (end.at === start.at || t <= start.at) return start.theta;
  if (t >= end.at) return end.theta;
  return start.theta + ((end.theta - start.theta) * (t - start.at)) / (end.at - start.at);
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

/** The ECDF over attempts, finite samples only: each step is its rank over every attempt, so a
 *  timed-out attempt never appears yet still holds the curve below 1 (the gap is the time-outs). */
export function ecdf(samples: Array<number>): Array<{ ms: number; share: number }> {
  return samples
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .map((ms, i) => ({ ms, share: (i + 1) / samples.length }));
}
