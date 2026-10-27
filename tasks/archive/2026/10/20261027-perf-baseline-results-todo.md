# Record the v0.1.0 NFR-PER results

**Created**: 2026-10-27
**Issue**: #191 (judgment cell + ramps), #193 (congestion presets and outage recovery)
**Design**: none — this records numbers measured under [`docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`](../../../../docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md); it changes no rule

## Milestones

### 1. The results doc

- **What**: `docs/perf/v0.1.0-baseline.md` (English, decided on #163) records the campaign as #191's results template asks: conditions, the judgment cell, the ramps, #193's cells, and every replaced or rerun round.
- **Files**: `docs/perf/v0.1.0-baseline.md` (new).
- **Reuse**: each cell's `summary.md` from `pnpm -s perf:report perf-results/<run>` on H. The tables are copied from it, not recomputed. The #191 and #193 comments already hold each cell's reading.
- **Sections**:
  - **Conditions.** Devices and OS, Chrome versions, network, image digest, and harness revision `f81a3f6` plus the uncommitted #217 port patch in `e2e/perf/stack.ts`, which is named as such.
  - **Judgment cell (`judge3`, 8 users × baseline × 20).**
    - The 002/004/005 table per direction with U and the verdict, the 003 joins (19 observed, so n<20 and no p95, reported as max and median), NFR-PER-001 (3/20) and NFR-PER-006 (H and G peaks).
    - Each failed round with its issue: round-01 aborted (#236), round-05 and round-16 ws-close (#237).
  - **Ramps.** 2 users (`ramp2`) and 4 users (`ramp4-all`, pooled from `ramp4-b` rounds 1–3 and `ramp4-c` rounds 1–2), with the pooling written out. The 4-user 001 failure is #239.
  - **#193 cells**, each as "this condition, this number", with no pass or fail.
    - **Stack-on reference** (`ref-on`).
    - **light, moderate and heavy.** The 1st runs (`light`, `moderate`) were taken while H ran on battery under extra load. They stay as reported results, labelled 1st, next to the 2nd runs (`light-b`, `moderate-b`), which give the condition's numbers. The reason is the one in each run's `RERUN.txt`.
      - heavy uses its 5-round 1st run; `heavy-b` (1 round) agrees with it.
      - moderate uses the criteria doc's provisional values, labelled "not measured", because the school Wi-Fi was not measured (#193 step 1).
    - **Outage recovery.** `outage20` (5 rounds) and `outage40` (3 rounds) are reported per path: document resync, chat backfill and socket reopen, the session notification (never reopens, #37), chat cases ①②③, and loss and duplication counts.
    - **Port blackhole** (1 round): a stall, not a reconnect, and how long the flush took.
  - **Replaced rounds.** These are grouped by run with count, class and reason. Listing them one by one would be 48 lines.
    - `judge`, `judge-b`, `judge-c`, `judge2`: U over 10 ms under the old rule (#215). Superseded by `judge3` after #226.
    - `ramp4`, `ramp4-b`: the reasons are taken from the #191 comments.
    - Rounds that were not replaced stay in the table even when they failed.
  - **Issues found** in this campaign (#209–#241), one line each. Their state stays in the issues.
  - **Raw data.** It stays on H, gitignored, and is not deleted until this PR merges.
- **Done**:
  - The p95, attempt, U, memory and RTT figures match each run's `summary.md` (spot-checked per table).
  - θ, the 003 join times and the `docker stats` peaks are read from the round files, because `summary.md` does not carry them. The doc's header says which is which.
  - The doc gives the verdict only for the judgment cell.

### 2. Point the roadmap at it

- **What**: ROADMAP's "what remains here is running it and recording the numbers" now links to the results doc.
- **Files**: `ROADMAP.md`.
- **Reuse**: nothing new.
- **Done**: `pnpm verify:docs` passes.

## Test selection

Use [the test-selection workflow](../../../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior. For each relevant layer, name existing tests
that cover it, required updates/new cases, or a concrete reason no change is needed.

- Vitest (logic / component / server / route): no change, because no code changes.
- Browser E2E (`e2e/`): no change, because no code changes.
- Container smoke (`.github/workflows/ci.yml`): no change, because no code changes.
- Docs: `pnpm verify:docs` (links, the task index).
- Commands and observed results (fill in before the PR):
  - `pnpm verify:docs`: clean (after one false positive, a backticked `perf-results/` read as a dead link, was reworded).
  - Every table was copied from the run's `summary.md` (perf:report at `f81a3f6`). The θ, 003 join and `docker stats` figures were read from the raw round files with a scratch script.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] `docs/perf/v0.1.0-baseline.md` has #191's two results tables filled in for `judge3`, plus the per-round θ/U and memory, and the conditions. `docker stats` is given as each cell's peak, in one resource table, not per round.
- [x] Each #193 cell has its applied settings, measured RTT, pooled p95 per direction (or per-path recovery), and a check that the degradation was removed.
- [x] Failed rounds are shown as failures. Replaced rounds have their class and reason. The 1st/2nd runs are both shown.
- [x] #37's failures (session reconnect never happens) are reported separately.
- [x] `pnpm verify:docs` passes.

## Cross-cutting

- Closes #191 and #193. After merge, the raw `perf-results/` on H may be deleted (#191's acceptance).
- No agreed doc changes. The SRS and the criteria doc are untouched. Wherever a result needs a rule interpretation, the doc names the rule's section rather than restating it.
- Open follow-ups stay as their issues: #217, #218, #238 (harness), #236, #237, #239 (product candidates), #241 (chat backoff), #190 (runbook).

## Review

Review (a separate Sonnet session, `/code-review low` then `/simplify`, report-only). Applied in 7cbaa37:
- **Rules linked, not restated.** Rules are left to the criteria doc and the runbook: nearest-rank p95, the #226 line fit, the memory metric, the replacement rule, the backoff (`docs/design/chat.md`), and the preset/protocol text. The doc keeps only the as-run deviations.
- **No issue status.** The "Issues found" table has no state column (`docs/conventions.md`: an issue's status lives in the issue). #213 and #216 are dropped, because they are not results.
- **Nothing that goes stale on merge.** Gone: the narration of unmerged harness fixes, and "kept until this file merges".
- **One resource-peaks table** replaces four scattered sentences. This also fixes the review's one correctness finding: the "stayed in the baseline's range" claim, which the numbers contradicted.
- **Merged tables.** The 1st and 2nd runs share one table with a run column. The judgment cell's row is gone from the ramps table, `heavy-b` is one sentence, and the blackhole and raw-data sections are shorter. The device IPs are gone.

Declined:
- **Collapsing the 20-row per-round table to ranges.** #191's results template asks for θ and U per round. The rows that look alike are the point: they show U holding under the rule from #226 across 20 rounds.
