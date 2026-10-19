# Perf harness counts the clock residual, not the drift, in U

**Created**: 2026-10-20
**Issue**: #215 (U grows with round length); blocks #191's judgment cell
**Design**: the clock section of [`docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`](../../docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md) (§기본 방식 1), changed here — an agreed document, so the PR waits for the team's agreement

## Milestones

### 1. U from a line through several readings

- **What**: a round's U per device is the worse round-trip bound plus the largest distance of any clock reading from the least-squares line through them, instead of plus the whole drift between start and end; θ is corrected along the same line.
- **Files**: `e2e/perf/stats.mts`, `e2e/perf/stats.test.mts`.
- **Reuse**: `offsetFrom` (Cristian's estimate per reading) and the correction path `thetaAt` → `toH` stay; only the line through the readings and the uncertainty change. With two readings the line is the one through both and U is the old formula, so a run without mid readings reports as before.
- **Done**: a steady drift over five readings gives U = the worse bound; a step at the middle reading raises U by its residual; two readings give the old value.

### 2. Read the clocks mid-round

- **What**: during the edit/chat phase the harness reads both clocks three more times (25, 50, 75 % of it) and stores them in `clock.json` as `mid`.
- **Files**: `e2e/perf/round.perf.ts`.
- **Reuse**: `readClock` as it is (15 samples, shortest round trip wins).
- **Done**: a round's `clock.json` has three `mid` entries for H and G.

### 3. Report both rules

- **What**: `perf:report` builds each device's readings from `start`, `mid` and `end`, judges with the new U, and shows the old U next to it per round.
- **Files**: `e2e/perf/report.mts`.
- **Reuse**: the per-round table and the pooled U already exist; one column is added.
- **Done**: an old run (`perf-results/judge`) reports the same U as before, with `U (legacy)` equal to it.

### 4. Docs

- **What**: the criteria doc and the runbook describe the new U; the 10 ms limit and "no reliance on OS NTP" stay.
- **Files**: `docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`, `docs/perf/runbook-ko.md`.
- **Reuse**: nothing new.
- **Done**: `pnpm verify:docs` passes.

## Test selection

- Vitest (logic / component / server / route): `e2e/perf/stats.test.mts` — port the clock tests to reading lists and add the line, step, noise and two-reading cases.
- Browser E2E (`e2e/`): no change — the regular suite does not run the perf harness.
- Container smoke (`.github/workflows/ci.yml`): no change — nothing here touches the stack.
- Perf harness itself: one validation round on the two-device rig (8 users, baseline) after merge-ready; its numbers decide whether the mid readings disturb the measurement.
- Commands and observed results (fill in before the PR):
  - `pnpm vitest run e2e/perf/stats.test.mts` — 19 passed. The steady-drift and step cases fail under the old formula (it charges the whole 7.2 ms drift).
  - `node e2e/perf/report.mts` on a copy of the v0.1.0 run `judge` (start and end readings only) — U per round 6.5 / 9.3 / 7.1 / 8.2 / 7.6 / 9.0 / 9.7 ms, the same as before, and `U (legacy)` equal to it.
  - `pnpm typecheck`, `eslint` on the four changed files, `pnpm verify:docs`, `pnpm comments` — clean.

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] `stats.test.mts` covers a steady drift, a step, noise within the bound and the two-reading fallback.
- [ ] `clock.json` of a new round has three `mid` readings per device.
- [ ] `perf:report` on an old run gives the same U as before.
- [ ] On the rig, a full round's new U is at most 6 ms with each device's residual at most 1 ms, and attempts overlapping a mid reading are not slower than the rest.
- [ ] `pnpm typecheck`, `pnpm verify:docs` and the comment budget pass.

## Cross-cutting

- The criteria doc's U definition was agreed on 2026-10-12 (#163); this changes it, so the team agrees in the PR before merge. Until then the campaign runs from this branch and reports both U rules.
- The measured image (`0.1.0@sha256:b14f53c0…`) does not change; the results doc names the harness commit.

## Review

Filled in at the end.
