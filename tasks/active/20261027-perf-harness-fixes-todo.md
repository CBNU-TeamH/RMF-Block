# Perf harness: end a stalled round, retry the port check, keep a timed-out join

**Created**: 2026-10-27
**Issue**: #217, #218, #238
**Design**: none — harness robustness and one report rule the criteria already state (#191 "Report shape"); [`docs/perf/runbook-ko.md`](../../docs/perf/runbook-ko.md) §16 changes with it

## Milestones

### 1. Wait for the port at release (#217)

- **What**: after `compose down`, `stackDown` waits up to a minute for the ports to come free, because Docker Desktop releases them a moment after `down` returns. The check before a round stays fail-fast, so a port that is really taken is reported at once.
- **Files**: `e2e/perf/stack.ts`, `e2e/perf/stack.test.mts` (new).
- **Reuse**: `free()` gains an optional wait. H's clone ran the retry inside the check, uncommitted, for the whole v0.1.0 campaign; the review moved the wait to the release.
- **Done**: a port held for half a second and then released passes a waiting check; a taken port fails the check at once.

### 2. End a stalled round and clean up after it (#218)

- **What**:
  - Playwright actions and navigations time out after a minute, and connecting to G does too.
  - A round that runs past `2 × MINUTES + OUTAGE + 10` minutes (`PERF_STALL_MINUTES` overrides) records `stalled`, then closes its pages and H's browser, so the hung call rejects. The round's own `catch` and `finally` then run: G's trace stops and the stack goes down.
  - The stack is taken down in `afterEach`, which runs even after a Playwright timeout, unlike the test's `finally`. The test timeout is the stall limit + 10 min, because the timer starts after `stackUp` (up to 5 min) and cleanup needs time after it.
- **Files**: `e2e/perf/round.perf.ts`, `playwright.perf.config.ts`.
- **Reuse**:
  - The existing `finally` already stops G's trace and takes the stack down.
  - The timer does what the rig's uncommitted `unhang.ps1` did by hand: it closed G's page over CDP and killed H's harness browsers, and it ended `ramp4-b` round-02 cleanly.
- **Done**:
  - A one-machine run with `PERF_STALL_MINUTES=2` stalls in the presenter phase and writes `stalled` + `aborted`.
  - It saves `server.log` and leaves no `rmf-perf-…` project behind.
  - Its next round starts without a port abort.

### 3. Keep a timed-out join in 003 (#238)

- **What**: `joinAttempt` (`stats.mts`) gives a round's 003 attempt: from G's join events, or as a timed-out one from a `join-timeout` signal when the round aborted before writing events. `perf:report` pools it before skipping an aborted round, and lists items in #191's order (002, 003, 004, 005).
- **Files**: `e2e/perf/stats.mts`, `e2e/perf/stats.test.mts`, `e2e/perf/report.mts`.
- **Reuse**: `pool` and `account` already treat a send with `t0 = NaN` and no receipt as timed out.
- **Done**:
  - `joinAttempt` returns the join from events; a timed-out attempt from `join-timeout` without events; `null` for a round that aborted before G joined.
  - A copy of `judge3` reports 20 attempted, 1 timed out, p95 635 ms.

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior. For each relevant layer, name existing tests
that cover it, required updates/new cases, or a concrete reason no change is needed.

- Vitest (logic / component / server / route):
  - New: `e2e/perf/stack.test.mts` covers the wait and the fail-fast check.
  - Extended: `stats.test.mts` covers `joinAttempt` in three cases.
- Browser E2E (`e2e/`): no change, because the regular suite does not run the perf harness. `e2e/fixtures.ts` is untouched.
- Container smoke (`.github/workflows/ci.yml`): no change, because nothing here touches the stack's images or startup.
- Perf harness itself: a one-machine stall run on H (milestone 2's Done). It is run by hand, because a hang cannot be staged in CI.
- Commands and observed results (fill in before the PR):
  - `vitest run e2e/perf`: 3 files, 23 tests pass, 3 s.
    - The first cut spawned the whole report (about 50 s on `/mnt/c`). The review replaced that with the pure `joinAttempt`.
  - `tsc --noEmit`, `eslint` on the changed files, `verify:docs` and `comment-budget`: all clean.
  - `perf:report` on a copy of `judge3`:
    - `003 G` changes from "19 / 19 / 0, n<20" to "20 attempted, 19 observed, 1 timed out, p95 635 ms, pass".
    - Every other row is unchanged, and the rows are in item order.
  - **H, one machine** (2026-10-27): `PERF_SINGLE_MACHINE=1 PERF_ROUNDS=2 PERF_USERS=2 PERF_MINUTES=1 PERF_STALL_MINUTES=2`.
    - Run twice: at `ffa0fac` (14:31–14:36) and after the review at `4a95f49` (15:09–15:15). Both runs gave the same result.
    - Both rounds hit the limit in the presenter phase and wrote `stalled` (phase `window`). `aborted: page.evaluate: Target page, context or browser has been closed` followed 0.3–3 s later.
    - Each round finished in 2.6–2.7 min with `signals.jsonl`, `meta.json`, `plan.jsonl` and `server.log` written.
    - Round 2 started without a port abort. `docker compose ls` was empty afterwards.
  - **Not run on the rig**:
    - **The remote-G path.** G's browser server was down, so it is unchecked that a stalled round ends G's trace and the next round starts without "still tracing". The rig's workaround closed G's page in the same way, and that ended `ramp4-b` round-02 cleanly on 2026-10-26. This fix closes G's context rather than its page.
    - **`afterEach` after a real Playwright timeout.** It was checked only with a throwaway spec: two timed-out tests ran `afterEach` twice and their `finally` blocks never.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] A released port is waited for at teardown; a taken port fails the check at once.
- [x] A stalled round ends by itself within its limit. It leaves `stalled` and `aborted` in `signals.jsonl`, stops G's trace and takes its stack down.
- [x] A Playwright test timeout leaves no stack behind (`afterEach`; checked with a throwaway spec).
- [x] `perf:report` keeps an aborted round's timed-out join in 003.
- [x] Runbook §16 and `docs/testing.md` describe the new behaviour.
- [x] `pnpm typecheck`, `pnpm verify:docs` and the comment budget pass.

## Cross-cutting

- The criteria doc (agreed) is unchanged. #238 makes the report follow a rule it already states.
- `judge3`'s 003 changes from "19 attempted, n<20" to "20 attempted, 1 timed out, p95 635 ms, pass". The results doc (`docs/perf/v0.1.0-baseline.md`, a separate PR) quotes whichever report it was run with and says so.
- After merge, H's measurement clone drops `unhang.ps1` and `g-unhang.mts`. It has already run this branch.
- Not done:
  - **A deadline per setup step.** The `stalled` phase and the `aborted` message already locate the hang.
  - **Ending a stale trace on G from a new round.** A trace can only be ended by the session that started it (`memory.ts`), so the fix stops trace leaks at the source instead.

## Review

Review: a separate Sonnet session ran `/code-review low`, then `/simplify`, report-only.

**Applied** (`4a95f49`):
- **The wait moved from the check to the release.** `stackDown` now waits for the ports to come free, and `stackUp` checks both ports at once and fails fast.
- **One teardown path.** `afterEach` is the only caller of `stackDown`; the round's `finally` still detaches Prometheus first.
- **The stall timer** closes H's browser whole, and only the contexts of the background users' and G's browsers.
- **The test timeout** is set from the stall limit (+10 min after CodeRabbit), so the timer always fires first. This holds for any `PERF_MINUTES`, which the fixed 40 min did not.
- **#238 as a pure `joinAttempt`.** It gives one definition of a 003 attempt and replaces a 50 s report-spawning test with a 3-case unit test. The report lists items in #191's order.
- **Shorter text.** The STALL comment is one line, and the runbook rows point to the appendix for the formula.

**Declined:**
- **Moving stack, browsers and cleanup into a Playwright fixture.** It is the more general shape, but it is a larger rewrite of the round, and the current shape now passes the one-machine check.
- **Dropping the action and navigation timeouts in favour of the stall timer alone.** They fail an unbounded click within a minute and name the locator. The timer stays for calls with no timeout option, such as `evaluate` and `newPage`.
- **Writing `events.jsonl` in `finally`.** A round that aborts after a successful join still loses that join's sample. Saving it means reading pages that may already be dead, which is a separate change. Noted on #238.

**CodeRabbit** (3 comments on `e5722f0`):
- **Fixed: `afterEach` now detaches Prometheus before `stackDown`** when a timeout skipped the round's `finally`. A still-connected Prometheus keeps `compose down` from removing the network.
- **Fixed: the test timeout is now the stall limit + 10 min.** The stall timer starts only after `stackUp`, which can take up to 5 min, so with + 5 the two deadlines could coincide.
- **Fixed: the port probe destroys any connection it accepts.** Otherwise a client that connected during the probe would hold `close()` open.
- **Declined: stopping G's trace and closing the browsers from `afterEach`.**
  - After a real timeout, the stall timer has already failed to unstick the round.
  - A call to G there can hang like the one that timed out.
  - The worker restart that follows a failed test closes the browsers anyway.
