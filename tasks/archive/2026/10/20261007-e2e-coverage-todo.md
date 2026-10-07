# Functional E2E coverage on an isolated stack

**Created**: 2026-10-07
**Design**: [Testing strategy](../../../../docs/testing.md); product contracts remain unchanged.

## Milestones

### 1. Isolated execution and users

- **What**: run Chromium against a disposable Compose project on loopback ports 3100/8180.
- **Files**: `scripts/e2e-isolated.mjs`, `e2e/fixtures.ts`, `e2e/helpers.ts`, `playwright.config.ts`, `package.json`.
- **Reuse**: resolve the existing Compose file; reuse API document setup and Playwright's context fixture lifecycle.
- **Done**: occupied ports fail without stopping their owners; teardown removes only this run's project and volumes; host secrets never enter artifacts.

### 2. Functional scenarios

- **What**: retain sync, Hangul IME and image-preview regressions; add UI auth/takeover, deduplicated tabs, bidirectional/late/concurrent edits, split/merge/history, eight users, tree CRUD, chat attribution/attachment and 20-second outage recovery.
- **Files**: `e2e/*.e2e.ts`, `e2e/network.ts`, `docs/testing.md`, `.github/workflows/ci.yml`.
- **Reuse**: stable block IDs and the IME observer; API only for setup, UI for the behavior under test.
- **Done**: DOM values/order converge without lost or duplicated input; active streams/sockets demonstrably close before outage assertions; initial Yorkie and session socket recovery diagnostics remain ordinary failing tests when the product lacks recovery.

### 3. Separate admin follow-up

- **What**: reserve admin setup, authorization, password change, kick, location navigation and restart persistence for a new branch after admin merges.
- **Files**: a separate `20261007-admin-e2e` task pair.
- **Reuse**: the fixture and runner built here.
- **Done**: no unmerged admin changes are copied, staged or altered; restart/setup tests get their own stack.

### 4. Integrate the merged baseline and test-selection workflow

- **What**: rebase on the actual admin merge, preserve shared-stack cleanup guidance, and require each feature/fix to assess E2E and container smoke coverage before its PR.
- **Files**: `AGENTS.md`, `CONTRIBUTING.md`, `docs/testing.md`, task and PR templates, this task pair.
- **Reuse**: existing five test layers, disposable runner and CI smoke steps; keep test-selection rules in `docs/testing.md` and link them from workflow entry points.
- **Done**: merged-baseline E2E outcomes are recorded, required new/updated tests belong in the feature PR, and each unneeded layer has a concrete reason in its task/PR.

## Acceptance

- [x] Lint, unit tests, production build, doc checks and comment budget run.
- [x] Existing and new functional E2E run on three independently created stacks, without retries or expected failures.
- [x] Failures distinguish test defects from product defects with reproduction and evidence.
- [x] CI keeps E2E non-blocking and uploads traces/report plus redacted logs.
- [x] Required review tools' actual availability/execution is recorded; PR uses the repository template.

## Cross-cutting

Functional scope: FR-020-01~08, FR-021-01/05/06, FR-022-01~03/09/12, FR-023-01/03~07, FR-060-01/02/04/05, FR-061-01~03, NFR-REL-001/004. Eight-user correctness is checked; 1-second propagation, 500MB memory, sustained load, actual LAN devices and Firefox/WebKit remain follow-up work. Wait limits (15s assertions, 120s eight-user/recovery tests) are not performance criteria.

## Review

Base: remote `main` at `550dc2b`; user location is merged, admin is not. The latest upstream change (`8d8d92e`, #169) only documents E2E data cleanup. At the user's request, this PR stays draft and rebase onto main (including that document change) waits until admin work is complete. Worktree: `/tmp/rmf-e2e-coverage`, branch `test/e2e-coverage`; original `feat/admin-page` index/worktree remain untouched.


## Measured verification

| Independent stack | Passed | Failed | Skipped / flaky / retries | Suite duration |
| --- | --- | --- | --- | --- |
| `rmf-e2e-6bfec62c` | 16 | 2 | 0 / 0 / 0 | 100.4s |
| `rmf-e2e-4fb72293` | 16 | 2 | 0 / 0 / 0 | 131.9s |
| `rmf-e2e-634a35e7` | 16 | 2 | 0 / 0 / 0 | 106.6s |

All 16 functional cases passed in all three runs, including eight users, Hangul composition,
local history preserving peer input, and a measured 20-second outage with actual stream/socket
termination followed by editor convergence and chat backfill. The whole suite exits 1; it is
**not green**. No assertions were weakened and no case was skipped or marked expected failure.
The two missing recovery paths remain product follow-up work under
[issue #37](https://github.com/CBNU-TeamH/RMF-Block/issues/37), which already calls for both paths:

- **Initial Yorkie failure**: abort Yorkie requests before first workspace navigation; observe
  `연결 끊김`; remove the blocker; the header never returns to `1명 접속 중` within the 15s assertion
  budget. `PresenceProvider`'s catch sets a terminal failure with no retry. Reproduce with
  `pnpm e2e:isolated --grep 'initial Yorkie'`.
- **Session notification reconnect**: observe active watches and workspace socket opens, close
  the actual workspace sockets and observe close events, restore connectivity, then claim the
  nickname in another context. The old session API returns 401, but socket opens remain at their
  pre-outage count and the old browser misses the notification. `SessionWatch` has no close
  handler/reconnect. Reproduce with `pnpm e2e:isolated --grep 'session notification'`.

Evidence is retained locally under `e2e-artifacts/<stack>/`: `results.json`, the standalone
`playwright-report/index.html`, failure `test-results/*/trace.zip` and redacted `server.log`.
All three HTML archives, JSON reports, failure trace archives and logs were inspected for
bootstrap credential URLs: none found. Host traces are disabled; browser-side bootstrap
navigation keeps the credential out of reporter step titles.

`pnpm lint`, `pnpm exec tsc --noEmit`, 673 unit tests, `pnpm build`, `pnpm verify:docs` and
`pnpm comments` passed. The existing production instrumentation Edge warning remains unchanged.
The Yorkie invariants also passed on the third isolated stack with `RPC=http://127.0.0.1:8180`.
Port-conflict execution exited clearly and left its owner running. Every complete run removed
its containers, volumes, network and app image; a subsequent Docker listing found no E2E
containers/volumes/networks. Admin worktree/index were never modified by this task.

The final selector refinement anchors the original sync/IME regressions to the captured block
ID; these two cases passed on fresh stack `rmf-e2e-1c90a514` (2 passed, 7.2s). The review changes additionally correct
fixture/performance documentation, set a bounded CI E2E-step timeout, and retry only refused or
timed-out readiness probes. Interrupting `rmf-e2e-afe8f00d` during a recovery test exited 130,
terminated all 11 owned subprocesses, and removed its containers, volumes, network and app image.

## Review execution and dispositions

- `/simplify`: Claude CLI, report-only; applied selection helper, unused-accessor cleanup and
  `performance.timeOrigin` for no-reload evidence. Kept the printed secret and resolved Compose
  configuration as explicitly requested; kept all-settled teardown so all closes are awaited.
- `/code-review low`: first local adaptation only ran an inline Sonnet pass. Re-ran the plugin
  with its multi-agent/scoring pipeline: Haiku eligibility/summary/scorers and Sonnet reviewers
  selected by the Agent model parameter (agents did not independently report full model IDs).
  Four reviewer lenses completed; the previous-PR agent's Bash read was denied in Claude's
  tool permissions. The parent covered part of that lens; Codex subsequently read review/inline
  comments on PRs #153, #156 and #159. No GitHub review comment was posted. This is a local-diff
  adaptation, not a review of an existing PR, and the limitations are retained here.
- Score 90: stale `joinedPage` reference in the performance rig document — corrected to
  `users.join` and the remaining document helpers at their actual paths.
- Score 75: summary/header and fixture trace/growth wording — corrected; readiness refusal/timeouts
  — bounded and retried explicitly. Reporter/wait-budget changes implement the user's plan.
- Other low-confidence observations: the admin pair is intentionally registered before its
  dependency merges, per the user's two-phase plan; the seeded history setup creates the trailing
  block through the existing editor path; 120s test overrides are explicit; a teardown exception
  is recorded by Playwright alongside the original failure, as seen in the development traces.
  Build-failure cleanup can print a missing-image error (the run already failed); this remains a
  diagnostic rather than a product defect. Interruption now terminates the owned process group.
- Previous PR #153 asks to distinguish a green container job from E2E success and to prove the
  IME scenario is reached. The PR verification retains separate E2E outcomes, and the existing
  CDP composition plus third-observer propagation checks remain. No product IME code changed.

At the first-phase baseline, admin integration was **not verified** because PR #170 was open.
Its setup/access/password/kick/location/restart coverage remains the separate
`20261007-admin-e2e` task; the post-merge compatibility run is recorded below. Sustained load, performance thresholds, LAN devices and other browsers remain
separate work. This task completes coverage implementation and reports remaining defects; it
does not claim those product paths are fixed.

## Post-merge verification and workflow completion

Rebased onto `upstream/main` at `2608675` after admin PR #170 and archive/conventions PRs #172/#173
merged. Resolved `docs/testing.md` by keeping #169's shared-stack storage cleanup instructions
alongside isolated execution; regenerated both task indexes from all task files. No application,
admin API, type or storage-format changes were needed. The original workspace's unrelated edits
were left alone.

On fresh stack `rmf-e2e-714f8265`, all 18 tests ran: **16 passed / 2 failed**, 105.8s,
zero skipped/flaky/retried cases. Only the same two #37 diagnostics failed. Eight-user edits,
active 20-second outage recovery, IME, tree updates and host/guest admission passed against the
actual admin merge. This is compatibility evidence, not completion of the separate admin E2E task.
The runner removed its containers, volumes, network and app image; Docker listings confirmed no
remaining project resources. The report, traces and logs contained no bootstrap credential URL.

`pnpm verify:fast` passed (705 unit tests), as did `pnpm exec tsc --noEmit`, `pnpm build`,
`pnpm verify:docs` and `pnpm comments`. The existing instrumentation Edge warning persists.
The CI host/guest/join/chat smoke shell was extracted without changing assertions and run on
this stack with loopback port 3100 and the generated password; it passed. Yorkie invariants
passed with `RPC=http://127.0.0.1:8180`. These are local results; CI results are reported separately
in the PR.

### Test selection

- **Vitest**: no new runtime behavior in the rebase/workflow update; the existing 705 tests cover
  the integrated baseline. The workflow text is checked by doc-link/consistency verification.
- **Browser E2E**: the new/updated `e2e/*.e2e.ts` cases and fixtures in this PR prove functional
  journeys and multi-user/recovery outcomes. The post-merge full suite above checks compatibility.
- **Container smoke**: existing CI HTTP/startup assertions cover the unchanged startup/auth
  contracts; no new smoke assertion is required by this test/tooling/documentation change. The
  shell and Yorkie invariant outcomes are recorded above.

At the user's request, this PR also closes the process gap: existing docs described layers and
bug regressions but did not require feature authors to assess smoke/E2E coverage. `docs/testing.md`
now owns that decision procedure; `AGENTS.md`, `CONTRIBUTING.md` and task/PR templates route to it.
Required test changes must ship in the feature/fix PR, with existing coverage or reasons recorded
for layers that need no change. Codex reviewed this documentation delta for duplicate rules,
links, test-layer distinctions and truthful evidence; the earlier Claude review passes above
still describe their actual scope and limitations.

CI's first rebased-head doc check found `playwright-report/` treated as a dead directory link on
its clean checkout. Local generated reports had hidden this. Removed the trailing slash from
that generated-artifact reference and checked docs from a fresh source export without reports.
