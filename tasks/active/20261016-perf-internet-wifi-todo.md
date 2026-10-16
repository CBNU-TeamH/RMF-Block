# Perf campaign on an internet Wi-Fi, run with Claude

**Created**: 2026-10-16
**Issue**: #191 (the on-device run this changes), #163
**Design**: [`docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`](../../docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md) — this task changes its measurement network; the operator steps are [`docs/perf/runbook-ko.md`](../../docs/perf/runbook-ko.md)

The rig was to run on an offline hotspot from a Linux laptop. On 2026-10-16 that stopped making sense: no one
can use Claude on the hotspot, and the library Wi-Fi was not congested, so delay is injected on purpose anyway.
Decided by the user, with the team's agreement beforehand:

- **Network**: H and G join the same internet-connected Wi-Fi with no client isolation. RMF-Block traffic stays
  on that LAN. No AP laptop.
- **Judgment cell** (8 users × baseline × 20) runs on that Wi-Fi with no injected delay. Other users' traffic
  is recorded as a condition.
- **Degradation** keeps the agreed method: a person applies it on G with the OS tool, only on H's 3000·8080,
  half each way. G's OS is not decided, so all three tools stay.
- **Claude drives H**: Claude Code (WSL) runs the harness in H's PowerShell, watches progress, makes the
  summaries, checks the pass criteria and asks a person for G-side steps. Optionally it reaches G over SSH,
  only between cells: to read the browser server's address from a log, and to apply delay on a Linux or
  macOS G. A person still starts the browser server on G's desktop, since a Chrome launched over SSH has no
  window there.

## Milestones

### 1. Runbook follows the new network and the Claude-run flow

- **What**: `runbook-ko.md` describes the internet Wi-Fi rig, Windows H's network requirements, and what Claude
  and people each do.
- **Files**: `docs/perf/runbook-ko.md`.
- **Reuse**: the existing sections; only the network, firewall, cleanup, troubleshooting and checklist parts
  change, plus one new section for running with Claude (§7.1, with the optional SSH paragraph).
- **Done**: no AP laptop or hotspot step is left; a Windows H with WSL mirrored mode can follow §2–§3 to a
  working round (`hostAddressLoopback`, Hyper-V rule, firewall limited to the peer's address);
  `pnpm exec playwright install chromium` is in §2.2; §8 reads U from `pnpm perf:report`.

### 2. Criteria doc names the new network

- **What**: the measurement network and where presets are reproduced change from the offline hotspot to the
  shared Wi-Fi; shared traffic joins the fixed conditions.
- **Files**: `docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md` (부하 구성, 시나리오 프리셋, 공통 측정 원칙 1).
- **Reuse**: nothing new.
- **Done**: no "오프라인 핫스팟" left as the measurement network.

### 3. Handout matches the runbook

- **What**: the Claude Docs handout (not in the repo) is brought in line.
- **Files**: https://claude.ai/code/artifact/3b6bcdaf-49ae-481b-9c29-ae3dd2d3c265
- **Reuse**: §3.1–3.4 were already rewritten for the new network.
- **Done**: no AP laptop or hotspot step left; each stage says what Claude does and what people do.

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior. For each relevant layer, name existing tests
that cover it, required updates/new cases, or a concrete reason no change is needed.

- Vitest (logic / component / server / route): no change — docs only, no harness code changes.
- Browser E2E (`e2e/`): no change — same reason.
- Container smoke (`.github/workflows/ci.yml`): no change — same reason.
- Commands and observed results (fill in before the PR):
  - `pnpm verify:docs` — clean (doc ownership, task index, dead links, README pair, doc refs, SRS sync/refs, declarations, skills mirror).
  - `grep -n "핫스팟\|AP 노트북"` on both docs — only the two "earlier plan" sentences (runbook §3.0, criteria 부하 구성).
  - Windows H, 2026-10-16: with `hostAddressLoopback=true` and WSL restarted, a container on port 3000 answers on H's own Wi-Fi address (`172.27.65.27 -> 200`); before the setting it timed out while `127.0.0.1` answered. The `never served /join` failures on the hotspot that day had this cause (plus one run with `<H_IP>` typed literally).
  - Not yet run: rehearsal A with G on the shared Wi-Fi (needs G there); reported on the PR.

## Acceptance

What has to be true for this task to be finished. Runnable checks beat prose.

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] `pnpm verify:docs` passes.
- [x] `grep -n "핫스팟\|AP 노트북" docs/perf/runbook-ko.md docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md` finds only the sentences saying the hotspot was the earlier plan (runbook §3.0, criteria 부하 구성).
- [ ] Rehearsal A on the chosen Wi-Fi, run by Claude: G reaches H (`/join` and Yorkie health 200), `"gRemote": true`, U ≤ 10 ms. Needs G on that Wi-Fi, so it runs after the PR opens and is reported there.

## Cross-cutting

- Team-agreed criteria change (network only). Thresholds, presets, cells and the degradation method are unchanged.
- #191 gets a comment on the network change.
- README "If a guest cannot connect" advises WSL mirrored networking but not `hostAddressLoopback` or the Hyper-V rule; whether real hosts need them is a separate question (follow-up issue, not this task).

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
