# Perf criteria — scope to "our performance under conditions"

**Created**: 2026-10-06
**Design**: none — the doc being changed, `docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`, is itself the design.

Professor feedback: no comparison with other services; show only "in this situation we get this performance".
The competitor-comparison section is folded (not deleted); what the main measurement still needs is promoted
out of it. Measurement stays on **separate devices** (host + guest, NTP method) — the same-PC two-window harness
is not adopted (it shares one NIC/CPU/radio).

## Milestones

### 1. Fold the comparison, re-frame the intro

- **What**: wrap "경쟁 도구 대비 네트워크 열화 시나리오 검증" in `<details><summary>` with a one-line "out of scope — professor feedback"; rewrite the two-question intro (lines 3–14), line 29 and the last "다음 단계" bullet to match.
- **Files**: `docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`.
- **Reuse**: nothing new; `<details>` has no precedent in `docs/` — confirm `verify:docs` accepts it and checks links inside it.
- **Done**: section collapsed on GitHub render, no content removed, intro no longer promises a tool-vs-tool answer.

### 2. Promote what the main measurement still needs

- **What**: new section **"측정 조건 매트릭스"** after the common principles — users (2/4/8) × network presets, plus the degradation-tool table; fix the "중도 혼잡" row's missing cell; add that `tc netem` shades egress only (split the RTT with `ifb` on the same client for symmetry) and is applied on guest client NICs only — never the server host or a gateway, which would slow every client. Promote the reconnect task (20 s, optional 40 s, vs the UC-022 30 s grace) to a "재연결" item under class C. Promote the pooled-p95 rule into common principle 3: class B/C = 5–10 runs × dozens of samples pooled (≥20 pooled), class A (003) = ≥20 runs; name the percentile method (nearest-rank, n=20 → 19th); record per-run p95 too.
- **Files**: same doc.
- **Reuse**: the existing preset and tool tables, moved not rewritten.
- **Done**: nothing the main body depends on lives only inside the folded block.

### 3. Tighten NFR-PER-001 / 006 and the conditions list

- **What**: 006 → script-sample the tab's renderer process memory every 10 s (one manual check that the OS metric matches Chrome's "Memory footprint"), measured in the same session as 001 and following its repeat count. 001 keeps "0 failures in 20", plus a bracketed note that fewer runs widen the guarantee to `3/n` and the report must say so. Conditions list gains: measure against the container (`pnpm docker:up`), record host spec and topology (host = server + client vs dedicated server) — a host acting as a client has a loopback leg, so A→B / B→A asymmetry is expected there and the "점검 신호" reading must account for it.
- **Files**: same doc.
- **Reuse**: AGENTS.md §2 "Run and verify".
- **Done**: 006 has a repeat count and no manual 60-reading sampling; 001's threshold is unchanged.

### 4. 부하 구성 — a new section in the criteria doc

- **What**: add **"부하 구성"** after the condition matrix. The target is 8 people using it normally, not request flooding, so no k6/JMeter (Yorkie is an HTTP stream plus CRDT state; replaying requests does not reproduce it). Two client roles:
  - **측정 클라이언트** (host + guest, 2–3 real devices, real Chrome): measure 002/004/005 latency and 006 memory. Cross-device, NTP method kept (see top).
  - **배경 부하 클라이언트** (the remaining 5–6 users' worth): one Node script on a separate device that opens N `yorkie-js-sdk` clients and only edits/chats — no rendering, so the rig machine is never the bottleneck. Same wire load as real users.
  - Workload pinned per user per 10 min: 20 edits, 10 chat messages, even spread. Fixed RNG seed, fixed input text, fixed seed-document size (CRDT slows and grows with document size); each run starts from a fresh workspace and a restarted container (sessions live in memory, so restart = reset).
  - Server side recorded with every run: `docker stats` of the app / Yorkie / Mongo containers every 5 s, stored beside the run's results, plus the host spec. This is what answers SRS §2.4's "depends on the host's compute".
  - Order: ① smoke (2 users, 1 min — harness and logs work) → ② ramp: 2 and 4 users on baseline, 5–10 runs each, p95 at each step (the report's main figure) → ③ main run (the SRS-judgement cell): 8 users × baseline × 10 min × 20 runs, 001 and 006 in the same session → ④ degradation: 8 users × the other three presets, 5–10 runs each; the preset goes on **guest devices only** — the host (server, and a loopback client when it also joins) and the background clients stay on baseline → ⑤ optional headroom (12/16/24 users or higher edit rate) to find where latency bends; marked "참고 측정 — SRS 범위 밖".
- **Files**: same doc.
- **Reuse**: workload numbers and the 001 fail conditions already in the doc; none are changed.
- **Done**: the doc says who measures, who only loads, what is pinned, what is logged, and in what order.
- **Defaults taken (change on review)**: headroom run included as optional reference; measuring clients = host + guest (phone optional via the echo method); host spec is recorded, and measured on a second host only if a second host machine exists.

### 5. Where the harness will live — a decision, not code

- **What**: the criteria doc states the location so Phase 5 does not decide it ad hoc. Unit tests stay colocated (`*.test.ts(x)` / `*.test.mts` next to the code, as now). Perf lives **inside the E2E layer that just landed**, as `e2e/perf/*.perf.ts`:
  - reuses `e2e/helpers.ts` (`joinedPage`, `createDocument`, `openDocument`) and the `E2E_BASE_URL` / `E2E_WORKSPACE_PASSWORD` convention — point `E2E_BASE_URL` at the host's LAN address and run one Playwright process per device;
  - **not collected** by `pnpm e2e` or CI: `playwright.config.ts` matches `**/*.e2e.ts` only, so `.perf.ts` is invisible to it. A separate `playwright.perf.config.ts` (long timeouts, one project per role) and a `pnpm perf` script arrive with the harness, not with this task;
  - per-device runs write JSONL (`marker → t0` / `marker → t1`, with the NTP offset from `chronyc tracking`); a later join by marker gives the latency, as the doc's class-B method already describes;
  - the background-load Node script sits in the same folder; results go to a gitignored `perf-results/`.
- **Not done here**: moving `e2e/` under a umbrella `tests/` directory. It would change `playwright.config.ts`, `ci.yml`, `docs/testing.md` and archived task links for a layout gain only — separate refactor if the team wants it. `docs/testing.md` is not touched until the harness exists (the doc's 다음 단계 already says so).
- **Files**: same doc.
- **Done**: one short subsection naming the folder, file suffix, the CI exclusion, and the result format.

## Acceptance

- [x] `pnpm verify:docs` passes.
- [x] No sentence of the comparison section is deleted (`git diff` shows only wrapping + moves — the preset table, the degradation-tool table and the DevTools bullet moved to the body, a pointer left in their place).
- [x] No NFR threshold changes (1 s / 3 s / 1 s / 1 s / 500 MB / 8 users, 0-in-20).
- [ ] Rendered on GitHub: the toggle collapses, tables intact — check on the PR's rich diff.
- [x] The doc names `e2e/perf` and `.perf.ts`; no file under `e2e/`, `playwright.config.ts` or CI is touched in this task.

## Cross-cutting

Doc-only. `SRS-ko.md` / `SRS-en.md` untouched (AGENTS.md §5). `ROADMAP.md` and `architecture.md` link to this file by path only, so no anchors break.

## Review

Filled in at the end.
