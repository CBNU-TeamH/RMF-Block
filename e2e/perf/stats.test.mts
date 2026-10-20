import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { account, ecdf, offsetFrom, p95, thetaAt, toH, uncertainty, verdict } from "./stats.mts";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("p95 — nearest rank over attempts", () => {
  it("takes the 19th of 20", () => {
    assert.equal(p95(range(20).reverse()), 19);
  });

  it("gives no p95 under 20 attempts", () => {
    assert.equal(p95(range(19)), null);
  });

  it("keeps one timed-out attempt in 20 off the 19th place", () => {
    assert.equal(p95([...range(19), Infinity]), 19);
  });

  it("lets two timed-out attempts in 20 reach it", () => {
    assert.equal(p95([...range(18), Infinity, Infinity]), Infinity);
  });
});

describe("verdict — p95 ± U against the budget", () => {
  it("draws the line exactly at the budget", () => {
    assert.equal(verdict(999, 0, 1000), "pass");
    assert.equal(verdict(1000, 0, 1000), "pass");
    assert.equal(verdict(1001, 0, 1000), "fail");
  });

  it("is inconclusive while the uncertainty straddles the budget", () => {
    assert.equal(verdict(994, 6, 1000), "pass");
    assert.equal(verdict(995, 6, 1000), "inconclusive");
    assert.equal(verdict(1006, 6, 1000), "inconclusive");
    assert.equal(verdict(1007, 6, 1000), "fail");
  });

  it("fails a p95 that timed out", () => {
    assert.equal(verdict(Infinity, 6, 1000), "fail");
  });
});

describe("account — pairing sends and receipts", () => {
  const sends = range(20).map((i) => ({ marker: `m${i}`, t0: 0 }));

  it("counts a receipt past the timeout as timed out", () => {
    const recvs = range(20).map((i) => ({ marker: `m${i}`, t1: i === 20 ? 10_001 : 100 }));
    const result = account(sends, recvs, 10_000);
    assert.equal(result.timedOut, 1);
    assert.equal(result.observed, 19);
    assert.equal(p95(result.samples), 100);
  });

  it("counts a send whose t0 was never seen as timed out", () => {
    const result = account([{ marker: "m1", t0: NaN }], [{ marker: "m1", t1: 100 }], 10_000);
    assert.deepEqual(result.samples, [Infinity]);
    assert.equal(result.timedOut, 1);
  });

  it("counts a missing receipt, a duplicate and a marker nobody sent", () => {
    const recvs = [
      ...range(19).map((i) => ({ marker: `m${i}`, t1: 100 })),
      { marker: "m1", t1: 300 },
      { marker: "stray", t1: 100 },
    ];
    const result = account(sends, recvs, 10_000);
    assert.deepEqual(
      { attempted: result.attempted, observed: result.observed, timedOut: result.timedOut, duplicate: result.duplicate, unmatched: result.unmatched },
      { attempted: 20, observed: 19, timedOut: 1, duplicate: 1, unmatched: 1 },
    );
    assert.equal(result.samples[0], 100);
  });
});

describe("clock — offset, uncertainty, correction", () => {
  it("reads the offset off the shortest round trip", () => {
    const offset = offsetFrom([
      { sent: 0, page: 1_000, received: 40 },
      { sent: 100, page: 1_103, received: 106 },
    ]);
    assert.deepEqual(offset, { at: 103, theta: 1_000, u: 3 });
  });

  // Five readings over a 12-minute window, θ drifting 0.6 ms a minute.
  const drifting = (theta: (i: number) => number) => Array.from({ length: 5 }, (_, i) => ({ at: i * 180_000, theta: theta(i), u: 2 }));

  it("adds the whole drift to the worse bound when only start and end were read", () => {
    assert.equal(uncertainty([{ at: 0, theta: 50, u: 2 }, { at: 600_000, theta: 54, u: 3 }]), 7);
  });

  it("charges nothing for a steady drift once mid-round readings show it is a line", () => {
    assert.ok(Math.abs(uncertainty(drifting((i) => 50 + 1.8 * i)) - 2) < 1e-9);
  });

  it("charges a step in the offset by how far it leaves the line", () => {
    const stepped = drifting((i) => 50 + 1.8 * i + (i === 2 ? 5 : 0));
    assert.ok(Math.abs(uncertainty(stepped) - (2 + 4)) < 1e-9);
  });

  it("corrects a G timestamp whether G runs ahead or behind", () => {
    const ahead = [{ at: 0, theta: 250, u: 1 }, { at: 1_000, theta: 250, u: 1 }];
    const behind = [{ at: 0, theta: -250, u: 1 }, { at: 1_000, theta: -250, u: 1 }];
    assert.equal(toH(ahead, 750), 500);
    assert.equal(toH(behind, 250), 500);
  });

  it("follows the line between the readings and holds it outside", () => {
    const clock = [{ at: 0, theta: 0, u: 1 }, { at: 100, theta: 10, u: 1 }];
    assert.equal(thetaAt(clock, 50), 5);
    assert.equal(thetaAt(clock, -5), 0);
    assert.equal(thetaAt(clock, 500), 10);
  });
});

describe("ecdf — the result chart's curve over attempts", () => {
  it("steps by rank over every attempt and stops short of 1 by the time-outs", () => {
    assert.deepEqual(ecdf([30, 10, Infinity, 20]), [
      { ms: 10, share: 0.25 },
      { ms: 20, share: 0.5 },
      { ms: 30, share: 0.75 },
    ]);
  });

  it("reaches 0.95 exactly at the nearest-rank p95", () => {
    const samples = [...range(19), Infinity];
    assert.equal(ecdf(samples).find((point) => point.share >= 0.95)?.ms, p95(samples));
  });
});
