# Two-device performance harness (e2e/perf)

**Created**: 2026-10-13
**Issue**: #189 (under #163; outage driver for #174/#193)
**Design**: [`docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`](../../docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md) and #189's "Measurement contracts", which this task carries into that doc. No `docs/design/` doc: nothing here is product code.

## Milestones

### 1. Aggregation and verdict logic

- **What**: pure functions for #189's contracts:
  - nearest-rank p95 over attempts, with a timed-out attempt ranked as `Infinity` and no p95 under 20 attempts;
  - pass / fail / inconclusive at p95 ± U;
  - the clock offset θ and bound u from the minimum-RTT sample;
  - the round's U and θ(t) interpolation;
  - attempted / observed / timed-out / unmatched / duplicate accounting.
- **Files**: `e2e/perf/stats.mts`, `e2e/perf/stats.test.mts`.
- **Reuse**: none; there is no percentile or clock code in the repo.
- **Done**: Vitest boundary cases pass:
  - n = 20 picks the 19th value;
  - 999 / 1000 / 1001 ms against 1000 ms;
  - 1/20 vs 2/20 timed out;
  - a positive and a negative θ;
  - all three verdicts.

### 2. Per-round stack

- **What**: one disposable Compose project per round, then teardown. It is derived from the base `docker-compose.yml` only, with no override and so no build. Its properties:
  - the app image is pinned to `ghcr.io/cbnu-teamh/rmf-block:0.0.1@sha256:11757ccef3076a8b8953cfb6f66b21618eb58d5ecbd1416e9f882864bbf42978`;
  - the workspace is seeded through `WORKSPACE_*`;
  - it publishes `PERF_BIND:PERF_APP_PORT/PERF_YORKIE_PORT`;
  - `YORKIE_PORT` is set to match.

  Teardown is `down --volumes` of that project only, after logs are saved. Alongside the stack, `docker stats` is sampled every 5 s.
- **Files**: `e2e/perf/stack.mts`.
- **Reuse**: the renaming and refusal checks of `scripts/e2e-isolated.mjs`, the same shape but not shared. That script builds from source on loopback; this one pins the release image on the LAN.
- **Done**:
  - a round's project comes up healthy with the pinned image;
  - an occupied port fails fast;
  - after teardown no `rmf-perf-*` container, volume or network is left.

### 3. Memory spike

- **What**: confirm that a CDP `Tracing` memory-infra trace returns Chrome's `private_footprint_bytes` for the measuring tab's renderer every 10 s. Check both a locally launched browser and one reached through `chromium.connect`. Timebox: 30 min.
- **Files**: `e2e/perf/memory.ts`.
- **Reuse**: none.
- **Done**:
  - samples arrive from both kinds of browser;
  - or the fallback (an OS sampler in G's browser-server script) is chosen and recorded in lessons.

### 4. Probe and round skeleton

- **What**:
  - **probe.ts**: an init script that records t0 at the sender event's own `timeStamp`, and t1 after a double rAF.
    - 002: a wrapped textarea `value` setter
    - 004: a MutationObserver on the chat region
    - 005: `scrollend` within ±8 px of the target block
    - 003: the tree link and `N명 접속 중`
  - **round.perf.ts** (the orchestrator). In each round it:
    - brings up the stack;
    - launches H's measuring Chrome;
    - has H seed a document of 60 blocks;
    - joins the background users through the fixture;
    - opens G (`PERF_G_WS` to connect, otherwise a local launch) and has G join through the UI;
    - measures θ at the start and at the end;
    - runs the edit/chat workload, the presenter phase and the convergence check;
    - writes the results as JSONL.
  - **browser-server.mts**: G's `launchServer`.
- **Files**:
  - `e2e/perf/probe.ts`, `e2e/perf/round.perf.ts`, `e2e/perf/browser-server.mts`
  - `playwright.perf.config.ts`
  - `package.json`: `perf`, `perf:browser`, `perf:report`
  - `.gitignore`: `/perf-results/`
- **Reuse**:
  - from `e2e/fixtures.ts`: `users.join`, for the background users;
  - from `e2e/helpers.ts`: `createDocument`, `openDocument`, `insertAt`, `blockValues`, `online`, `openChat`, `sendChat`;
  - the `E2E_*` conventions and `E2E_RUN_ID` precedent from `playwright.config.ts`.
- **Done**: a 2-user, 1-minute round on this machine yields joined samples for 002, 003, 004 and 005, and records θ and U.

### 5. Eight users, failure signals, report

- **What**:
  - NFR-PER-001 signals:
    - HTTP ≥ 400 responses, against an expected list that starts empty;
    - WebSocket closes;
    - Watch terminations seen through CDP;
    - the `⚠ 연결 끊김` badge;
    - convergence across all eight clients, and chat delivered exactly once.
  - A `conditions.json` per run.
  - A G-side HTTP RTT probe.
  - `report.mts`, which turns the run directory into `summary.json` and a markdown table.
- **Files**: `e2e/perf/round.perf.ts`, `e2e/perf/report.mts`.
- **Reuse**: the Watch observation pattern from `e2e/network.ts`.
- **Done**: an 8-user, 2-minute round passes its convergence check, and the report shows attempted / observed / timed-out counts, p95, U and a verdict per item and direction.

### 6. Outage rounds (`PERF_OUTAGE=20|40`)

- **What**: #193's short protocol:
  1. 2 minutes of work;
  2. an outage cut on G only;
  3. restore, then the resync time per path (document, chat, session);
  4. chat cases ① backfill, ② failed send, ③ the explicit `전송 실패 · 다시 보내기`;
  5. 2 more minutes of work, then convergence.
- **Files**: `e2e/perf/round.perf.ts`.
- **Reuse**: `networkProbe` from `e2e/network.ts`.
- **Done**: one 20 s outage round on this machine reports all three paths and all three chat cases.
- **If time runs out**: this may follow in a later commit. It is needed before #193 (Friday), not before #191.

### 7. Docs

- **What**:
  - **The criteria doc** gets the following:
    - the measured-offset clock method;
    - the two-device topology with headless background users;
    - the 005 marker and its definition;
    - per-round fresh volumes;
    - 003 samples from the baseline joins;
    - the order, with 8 × baseline first;
    - the ack/echo sections, scoped to clients whose clock cannot be read;
    - `e2e/perf` instead of `lib/` for the aggregation logic;
    - the values decided on 2026-10-12, with their "팀 미합의" marks removed.
  - **The runbook**: #190's draft lands as `docs/perf/runbook-ko.md`, with every `<TBD>` filled except #192's observation section.
  - **`AGENTS.md` §5**: lists the Korean runbook as an exception.
  - **`docs/testing.md`**: a short paragraph on the perf harness, which runs outside CI.
- **Files**: `docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`, `docs/perf/runbook-ko.md`, `AGENTS.md`, `docs/testing.md`.
- **Reuse**: #190's body.
- **Done**: `pnpm verify:docs` passes.

## Test selection

- **Vitest**: new `e2e/perf/stats.test.mts`, collected by the default glob. No app code changes, so the other layers need nothing.
- **Browser E2E (`e2e/`)**: unchanged. `playwright.config.ts` still collects only `*.e2e.ts`, so `*.perf.ts` stays out of `pnpm e2e` and CI. The harness itself is checked by the single-machine runs below.
- **Container smoke (`.github/workflows/ci.yml`)**: unchanged. Neither the app nor the compose file changes.
- **Commands and observed results** (fill in before the PR):
  - `pnpm test`
  - the 2-user, 1-minute round and the 8-user, 2-minute round on this machine, with G behind `perf:browser` on localhost
  - `pnpm perf:report`
  - the teardown check (`docker compose ls`, `docker volume ls`)
  - `pnpm lint`, `pnpm comments`, `pnpm verify:docs`

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] #189's acceptance list. Two of its items are checked at #191's gate 2 (two-device rehearsal), not here: memory samples from both H and G, and U within its limit.
- [ ] No app code, compose file or E2E collection change.

## Cross-cutting

- **Requirements**: NFR-PER-001…006, FR-022-12, NFR-REL-001.
- **Product**: no product, API or storage change.
- **Repo files**: the new `perf-results/` directory is gitignored.
- **Docs**: the Korean runbook adds an `AGENTS.md` §5 exception.

## Review

Filled in at the end.
