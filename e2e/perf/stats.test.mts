import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { account, offsetFrom, p95, relative, thetaAt, toH, uncertainty, verdict } from "./stats.mts";

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

  it("subtracts H's offset from G's and adds their bounds", () => {
    assert.deepEqual(relative({ at: 5, theta: 300, u: 2 }, { at: 6, theta: 1, u: 1 }), { at: 5, theta: 299, u: 3 });
  });

  it("adds the drift to the worse bound", () => {
    assert.equal(uncertainty({ start: { at: 0, theta: 50, u: 2 }, end: { at: 600_000, theta: 54, u: 3 } }), 7);
  });

  it("corrects a G timestamp whether G runs ahead or behind", () => {
    const ahead = { start: { at: 0, theta: 250, u: 1 }, end: { at: 1_000, theta: 250, u: 1 } };
    const behind = { start: { at: 0, theta: -250, u: 1 }, end: { at: 1_000, theta: -250, u: 1 } };
    assert.equal(toH(ahead, 750), 500);
    assert.equal(toH(behind, 250), 500);
  });

  it("interpolates the offset between the two readings and holds it outside", () => {
    const clock = { start: { at: 0, theta: 0, u: 1 }, end: { at: 100, theta: 10, u: 1 } };
    assert.equal(thetaAt(clock, 50), 5);
    assert.equal(thetaAt(clock, -5), 0);
    assert.equal(thetaAt(clock, 500), 10);
  });
});
