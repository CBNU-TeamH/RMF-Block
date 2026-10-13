# Observation stack and result charts for the perf campaign

**Created**: 2026-10-13
**Issue**: #192 (under #174), with its [decisions comment](https://github.com/CBNU-TeamH/RMF-Block/issues/192#issuecomment-6139171363)
**Design**: no `docs/design/` doc, because nothing here is product code. The rules this follows come from four places:
- the server section of [`docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`](../../docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md), which this task extends;
- #192's scope;
- #174;
- the harness from #189.

Prometheus and Grafana explain degradation and recovery. They never judge NFR-PER: the harness's browser samples remain the judgment source. Three decisions apply (2026-10-13):
- **The stack is long-lived.** It runs for the whole run. The harness connects it to each round's network and disconnects it at teardown.
- **cAdvisor is tried first.** If it fails, the documented `docker stats` fallback applies.
- **The judgment cell runs with the stack off.**

The result charts are drawn by `pnpm perf:report`, not Grafana.

## Milestones

### 1. Spike: cAdvisor, Yorkie metrics, chart rendering

- **What**: answer three questions on this machine (WSL2 + Docker Desktop). Timebox: 45 min.
  1. Does cAdvisor return per-container CPU, memory and network for a round's `app`, `yorkie` and `mongo`?
  2. Does Yorkie 0.7.23 serve `/metrics` on its profiling listener (port 8081) without extra flags? Which metric names does it expose?
  3. Does Observable Plot render a static SVG in Node through `happy-dom` (already a devDependency), and does `pnpm typecheck` (#197) accept its types?
- **Files**: none committed. The outcomes go into lessons.
- **Reuse**: `stackUp` in `e2e/perf/stack.ts` brings up a round's stack to probe.
- **Done**: each question has an answer in lessons. Where one fails, the fallback is chosen:
  - for (1), `docker stats`, recorded as such;
  - for (2), the flags that enable metrics, passed only when observing;
  - for (3), the library's UMD build inlined into the page instead of server-side SVG.
- **Outcome (2026-10-13)**: all three answered; details in lessons.
  - (2) and (3) work as planned.
  - (1) works only in cAdvisor's raw cgroup mode on Docker Desktop, where series carry the container ID but no name. The user chose to keep cAdvisor and have the harness map ID to name, which reshapes milestones 2 and 3 as written below.

### 2. Observation stack

- **What**: a Compose project `rmf-observe` that stays up for the whole run.
  - **Images**: pinned Prometheus and Grafana, plus cAdvisor if milestone 1 passed.
  - **Prometheus** scrapes every 5 s, the same cadence as `docker stats`. Its main config loads one generated file through `scrape_config_files`, and Prometheus runs with `--web.enable-lifecycle`.
    - The generated file holds the cAdvisor job, plus, while a round is attached, that round's Yorkie job and the cAdvisor relabel rules that turn `id` into `name`.
    - The harness rewrites it and calls `/-/reload` on attach and on detach.
    - This replaces the planned `file_sd`, because relabel rules cannot come from service discovery.
  - **cAdvisor** runs in raw cgroup mode (`--docker=unix:///nonexistent.sock --raw_cgroup_prefix_whitelist=/docker/`). On Docker Desktop, its Docker handler cannot read the engine's image store (lessons). The relabel regex matches the container ID anywhere in `id`, so a Linux host's cgroup layout matches too.
  - **Grafana** is provisioned from files: the datasource, a dashboard provider and one dashboard. The dashboard shows the round containers' CPU, memory and network, the Yorkie panels chosen from milestone 1, and the harness's annotations.
  - **Grafana access**: published on `127.0.0.1` only, with anonymous Editor, so the harness posts annotations without a credential.
  - **Exposure**: nothing is published to the LAN.
  - **Lifecycle**: `pnpm perf:observe` brings it up. The runbook gives the `down` command, and Prometheus's data volume is kept until the operator removes it.
- **Files**: `e2e/perf/observe/compose.yml`, `e2e/perf/observe/prometheus.yml`, `e2e/perf/observe/grafana/` (provisioning and the dashboard JSON), `package.json`.
- **Reuse**: nothing like it exists. It follows the pinning and comment conventions of `docker-compose.yml`. The product's compose file is not touched.
- **Done**:
  - `pnpm perf:observe` comes up healthy;
  - the cAdvisor target is up, or the fallback is recorded;
  - the dashboard loads;
  - `docker ps` shows no observation port on a non-loopback address.

### 3. Harness attach behind `PERF_OBSERVE=1`

- **What**: a new `e2e/perf/observe.ts`, called from `round.perf.ts` only when `PERF_OBSERVE=1`.
  - **`attach(stack)`**: `docker network connect` puts Prometheus on the round's network, `<project>-default`. It then does two more things:
    - reads the round's container IDs with `docker inspect`;
    - writes the generated scrape file, with the Yorkie job (`<project>-yorkie:8081`, labelled with run and round) and the cAdvisor relabel rules from ID to container name, and reloads Prometheus.
  - **`detach(stack)`**: rewrites the scrape file without the round, reloads Prometheus and disconnects it. It **runs before `stackDown`**, because `compose down` cannot remove a network that still has a foreign endpoint.
  - **`annotate(text, tags)`**: posts to Grafana's annotation API at round start and end, and at the outage cut and restore.
  - **Records**: `conditions.json` records `observe: true|false`.
  - **Failures**: an observation failure is printed and noted in `meta.json`, never written as a `signals.jsonl` kind. Diagnostics must not fail NFR-PER-001.
  - **Unset**: no docker network call and no HTTP request, so the judgment path is byte-for-byte what #194 shipped.
- **Files**: `e2e/perf/observe.ts`, `e2e/perf/round.perf.ts`, and `e2e/perf/stack.ts` only if milestone 1(2) needs Yorkie flags when observing.
- **Reuse**:
  - from `e2e/perf/stack.ts`: `Stack`, `stackUp`/`stackDown` and its `docker()` call pattern;
  - from `round.perf.ts`: the nested `finally` (teardown order) and `meta.cutAt`/`restoreAt`.
- **Done**:
  - **Observed run**: a 2-user, 1-minute round with `PERF_OBSERVE=1` on this machine shows four things:
    - the round's Yorkie target up during the round;
    - cAdvisor series for its containers;
    - start and end annotations on the dashboard;
    - after the round, the project fully removed with no endpoint left on the observation side.
  - **Outage run**: an outage round adds cut and restore annotations.
  - **Unset run**: behaves exactly as before.

### 4. Result charts in `pnpm perf:report`

- **What**: `report.mts` also writes `summary.html`, a static page with no script that opens offline on H.
  - **Library**: Observable Plot (`@observablehq/plot`, plus `d3` if pnpm needs it resolvable), as devDependencies only. Its rules, dots, ticks and error bars draw budget lines and p95 ± U without plugins. Rendered through happy-dom, it writes plain SVG.
  - **Source of truth**: the charts are drawn from the same objects `summary.json` is written from, so a picture and a verdict cannot disagree.
  - **Charts**:
    1. the latency ECDF per item and direction, over attempts, with the budget line and the p95 mark; timeouts are drawn at the right edge as ∞;
    2. p95 ± U against the budget for each item and direction, coloured by verdict;
    3. each round's memory peak for H and G, against 500 MiB;
    4. NFR-PER-001 per round: failure kinds, or aborted;
    5. the outage rounds' recovery numbers, as a table.
- **Files**: `e2e/perf/report.mts`, `e2e/perf/stats.mts`, `e2e/perf/stats.test.mts`, `package.json`, `pnpm-lock.yaml`.
- **Reuse**:
  - from `stats.mts`: `account`, `p95` and `verdict`;
  - from `report.mts`: `items` and `perRound`;
  - `happy-dom`.

  A small pure helper turns `account().samples` into ECDF points, and it is the only new logic that needs a test.
- **Done**:
  - `pnpm perf:report` on an existing local run writes `summary.html`;
  - every p95, verdict and memory value on it matches `summary.md`;
  - it renders with networking off.

### 5. Docs

- **What**:
  - **Runbook** (`docs/perf/runbook-ko.md`):
    - §14 becomes the operator procedure: start the stack, open Grafana, run with `PERF_OBSERVE=1`, the abort rule, stop and clean up;
    - §8, §9 and §15 mention `summary.html`;
    - the appendix gets `PERF_OBSERVE` and the Grafana address.
  - **Criteria doc, server section**: the scrape cadence, the metrics used, the dashboard and how overhead is reported (descriptively, with run-to-run variation), and where the result charts come from.
  - **`docs/testing.md`**: one line in the perf layer.
- **Files**: `docs/perf/runbook-ko.md`, `docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`, `docs/testing.md`.
- **Done**: `pnpm verify:docs` is clean, and every command in §14 was run once in milestones 2 and 3.

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior. For each relevant layer, name existing tests
that cover it, required updates/new cases, or a concrete reason no change is needed.

- **Vitest**:
  - a new case in `e2e/perf/stats.test.mts` for the ECDF helper: rank / n, ties, and timeouts placed at ∞ while still counting in n;
  - `observe.ts` is Docker and HTTP I/O with no branching worth a unit test, so milestone 3 covers it by hand.
- **Type check**: `pnpm typecheck` (#197) covers every new `.ts`/`.mts`, including the chart library's types.
- **Browser E2E** (`e2e/`): unchanged. `playwright.config.ts` collects `*.e2e.ts` only, and the perf harness stays out of `pnpm e2e`.
- **Container smoke** (`.github/workflows/ci.yml`): unchanged. The product's `docker-compose.yml` is not touched, and nothing in CI reads `e2e/perf/observe/`.
- **Commands and observed results** (2026-10-13, this machine: WSL2 + Docker Desktop, bundled headless Chromium, `PERF_SINGLE_MACHINE=1`):
  - `vitest run e2e/perf/stats.test.mts`: 16 passed, including the two new ECDF cases. `pnpm typecheck`, `eslint e2e/perf`, `pnpm comments` and `pnpm verify:docs` are clean.
  - `pnpm perf:observe`:
    - healthy, with the cAdvisor target up;
    - the dashboard is provisioned;
    - only `127.0.0.1:3300` and `127.0.0.1:9090` are published.
  - **Observed round** (`PERF_OBSERVE=1`, 2 users × 1 min): passed in 3.7 min.
    - During the round, the `yorkie` target was up, and the cAdvisor series came in named `rmf-perf-obs1-1-{app,mongo,yorkie}`.
    - Afterwards, the scrape file was back to cAdvisor only, Prometheus was on its own network only, and no `rmf-perf` project or network was left.
    - One "measured window" annotation was posted.
    - Results: 002 p95 161 / 181 ms, 005 p95 381 / 335 ms, 0 failures, memory H 108 / G 78 MiB.
  - **Observed outage round** (`PERF_OUTAGE=20`): passed in 3.4 min.
    - Annotations: window, cut and restore.
    - Recovery: document 382 ms, chat 9.9 s (#37's socket backoff), session — (#37), failed send shown, resend 53 ms. 0 failures.
  - `pnpm perf:report`: `summary.html` renders offline (checked in Playwright with `offline: true`), and its numbers match `summary.md`.

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] #192's single-machine items:
  - targets up and dashboards render on the pinned versions;
  - available metrics recorded;
  - container metrics from cAdvisor or the documented `docker stats` fallback;
  - the judgment cell untouched when `PERF_OBSERVE` is unset;
  - runbook §14 and the criteria doc's server section completed.
- [ ] `pnpm perf:report` writes `summary.html`, and its numbers match `summary.md`.
- [ ] Not done here, and recorded as such: the stack-on reference cell (8 users × 5 rounds) and its overhead against #191's stack-off rounds. Both run on the two devices during the campaign, in the order the decisions comment fixes.

## Cross-cutting

- **Requirements**: none judged here. This serves #174 and #193's diagnostics, and makes the NFR-PER-001…006 results visible.
- **Product**: no product, API or `docker-compose.yml` change.
- **Security**:
  - Grafana and Prometheus bind to loopback only, and Yorkie's metrics listener is reached on the round's internal network, never the LAN (the hotspot is an open subnet);
  - cAdvisor's host mounts run on H only.
- **Dependencies**: `@observablehq/plot` (plus `d3` if needed) as devDependencies, so nothing reaches the app bundle or the release image.
- **Docs**: the runbook stays Korean (`AGENTS.md` §5).

## Review

- **Shipped**: milestones 1–5.
- **Review round** (before the PR): `/code-review low` found nothing. `/simplify` ran from four angles (reuse, simplification, efficiency, altitude), and these were adopted:
  - **Shared row cells.** The md and HTML round tables share one `cells()`, which also brings the missing RTT column into the HTML table.
  - **Fewer lookups per round.** Container names come from `stack.containers`, and the Yorkie target is that list's `-yorkie` entry. One `docker inspect` returns both the IDs and the network.
  - **Scrape file on a bind mount.** The generated scrape file is a gitignored bind mount (`e2e/perf/observe/generated`), so applying it is a write plus `/-/reload`. The `docker cp`, the named volume and the temp directory are gone.
  - **Less collection work on H.** cAdvisor collects only `cpu,memory` every 5 s, and the scrape keeps only the two series the dashboard reads before the per-ID rules run: 155 samples per scrape become 8.
  - **Dashboard refresh off.** An open Grafana tab no longer queries every 5 s on H. The runbook says to look after a round.
  - **Clean-ups**: the module-only exports are gone, and so is the redundant `null` check.
- **Declined**:
  - inferring the network as `<project>_default`: it is `<project>-default`, and `inspect` stays;
  - `cgroup_parent` in `stackUp` to name cgroups: it changes the measured stack, and it depends on the cgroup driver;
  - publishing Yorkie's 8081 instead of joining the round network: with `PERF_BIND=0.0.0.0` that would expose metrics to the LAN, and `host.docker.internal` is not portable to a Linux host;
  - dropping cAdvisor for the `docker stats` file: the user chose to keep cAdvisor;
  - removing the ECDF dots: 003's one point per round needs them;
  - inlining `observeUp` into `observe-up.mts`: it would only trade that export for `apply` and `COMPOSE`.
- **Found while making the briefing's sample charts**: `perf:report` pooled every round's markers as they were. A replacement round (runbook §9) comes from a new run whose markers repeat the original rounds' numbers (`~m:1:…`), so pooling it in would pair sends with another round's receipts.
  - Seen as 42 "unmatched / dup" when three first rounds were stitched into one run.
  - `pool()` now scopes markers by the round's folder, which brings that run to 0 (plus the outage round's 1–2 cut-time receipts that have no counted send, unchanged since #194).
  - A single run's numbers do not change, for example `obs1`: 161 / 181 ms both before and after.
- **Also found while making the sample charts**: Grafana drew a finished round's memory flat for 5 min. A `/-/reload` restarts the scrape loop, so the series that left with the round get no staleness marker, and the default lookback is 5 min. Prometheus now runs with `--query.lookback-delta=15s` (three scrapes), and a round's lines end within 15 s of its teardown.
- **Rerun after the fixes**: an observed outage round passed in 3.5 min.
  - During the round, the `yorkie` target was up and the containers were named.
  - All three annotations were posted. Afterwards, nothing was left.
  - The md and HTML rows are identical.
