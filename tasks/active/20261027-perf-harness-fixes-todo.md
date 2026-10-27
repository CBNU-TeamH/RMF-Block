# Perf harness: end a stalled round, retry the port check, keep a timed-out join

**Created**: 2026-10-27
**Issue**: #217, #218, #238
**Design**: none — harness robustness and one report rule the criteria already state (#191 "Report shape"); [`docs/perf/runbook-ko.md`](../../docs/perf/runbook-ko.md) §16 changes with it

## Milestones

### 1. Retry the port check (#217)

- **What**: `free()` retries `EADDRINUSE` every 2 s for up to a minute before it reports the port as taken, so a round no longer races Docker Desktop releasing the previous round's port.
- **Files**: `e2e/perf/stack.ts`, `e2e/perf/stack.test.mts` (new).
- **Reuse**: the same logic ran uncommitted on H's measurement clone for the whole v0.1.0 campaign.
- **Done**: a port held for half a second and then released passes the check.

### 2. End a stalled round and clean up after it (#218)

- **What**:
  - Playwright actions and navigations time out after a minute, and connecting to G does too.
  - A round that runs past `2 × MINUTES + OUTAGE + 10` minutes (`PERF_STALL_MINUTES` overrides) records `stalled`, then closes its pages and H's browser, so the hung call rejects. The round's own `catch` and `finally` then run: G's trace stops and the stack goes down.
  - A stack still up after the test (a Playwright timeout skips `finally`) is taken down in `afterEach`.
- **Files**: `e2e/perf/round.perf.ts`, `playwright.perf.config.ts`.
- **Reuse**:
  - The existing `finally` already stops G's trace and takes the stack down.
  - The timer does what the rig's uncommitted `unhang.ps1` did by hand: it closed G's page over CDP and killed H's harness browsers, and it ended `ramp4-b` round-02 cleanly.
- **Done**:
  - A one-machine run with `PERF_STALL_MINUTES=2` stalls in the presenter phase and writes `stalled` + `aborted`.
  - It saves `server.log` and leaves no `rmf-perf-…` project behind.
  - Its next round starts without a port abort.

### 3. Keep a timed-out join in 003 (#238)

- **What**: `perf:report` counts a `join-timeout` signal as one timed-out 003 attempt, even in a round that then aborted and wrote no `events.jsonl`.
- **Files**: `e2e/perf/report.mts`, `e2e/perf/report.test.mts` (new).
- **Reuse**: `pool` and `account` already treat a send with `t0 = NaN` and no receipt as timed out.
- **Done**:
  - A round folder holding only `conditions.json` and a `signals.jsonl` with `join-timeout` + `aborted` reports `003 G` as 1 attempted, 1 timed out.
  - A copy of `judge3` reports 20 attempted, 1 timed out, p95 635 ms.

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior. For each relevant layer, name existing tests
that cover it, required updates/new cases, or a concrete reason no change is needed.

- Vitest (logic / component / server / route):
  - New: `e2e/perf/stack.test.mts` (the retry).
  - New: `e2e/perf/report.test.mts` (runs the report on a fixture run folder).
  - Unchanged: `stats.test.mts`.
- Browser E2E (`e2e/`): no change, because the regular suite does not run the perf harness. `e2e/fixtures.ts` is untouched.
- Container smoke (`.github/workflows/ci.yml`): no change, because nothing here touches the stack's images or startup.
- Perf harness itself: a one-machine stall run on H (milestone 2's Done). It is run by hand, because a hang cannot be staged in CI.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] `free()` retries a released port, and a port still held after a minute keeps the old message.
- [ ] A stalled round ends by itself within its limit. It leaves `stalled` and `aborted` in `signals.jsonl`, stops G's trace and takes its stack down.
- [ ] A Playwright test timeout leaves no stack behind.
- [ ] `perf:report` keeps an aborted round's timed-out join in 003.
- [ ] Runbook §16 and `docs/testing.md` describe the new behaviour.
- [ ] `pnpm typecheck`, `pnpm verify:docs` and the comment budget pass.

## Cross-cutting

- The criteria doc (agreed) is unchanged. #238 makes the report follow a rule it already states.
- `judge3`'s 003 changes from "19 attempted, n<20" to "20 attempted, 1 timed out, p95 635 ms, pass". The results doc (`docs/perf/v0.1.0-baseline.md`, a separate PR) quotes whichever report it was run with and says so.
- After merge, H's measurement clone drops its local `stack.ts` patch, `unhang.ps1` and `g-unhang.mts`.
- Not done:
  - **A deadline per setup step.** The `stalled` phase and the `aborted` message already locate the hang.
  - **Ending a stale trace on G from a new round.** A trace can only be ended by the session that started it (`memory.ts`), so the fix stops trace leaks at the source instead.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
