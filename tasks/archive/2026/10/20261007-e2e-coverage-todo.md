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

Admin integration is **not verified**: PR #170 is still open. Its setup/access/password/kick/
location/restart coverage remains the separate `20261007-admin-e2e` task and will use the actual
merged baseline. Sustained load, performance thresholds, LAN devices and other browsers remain
separate work. This task completes coverage implementation and reports remaining defects; it
does not claim those product paths are fixed.
