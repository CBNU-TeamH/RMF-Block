# System tests for the requirements the D07 test report left unexercised

**Created**: 2026-11-18
**Issue**: none yet. The 46 cases are the D07 draft's "lower-level only" rows (§6) and the A-3 table (§7.7); open one if the team wants it tracked.
**Design**: none. This adds tests, not behaviour. The behaviours under test are in [`docs/SRS-en.md`](../../docs/SRS-en.md) and the design docs each case's FR points at.

## What this is

The D07 software system test report counts 144 cases. 57 were not run at system level: **46** pass only at the unit/component layer (about 44 distinct FRs), and **11** have no test at all. This task takes the 46 to a system test (the container plus a real browser, or the HTTP API of the running stack, as `e2e/` already does) and handles what it can of the 11. The goal is a PASS or a recorded FAIL for each case against a running stack, not a green unit layer.

Out of scope: fixing defects it finds (each gets its own issue, and a known one is marked `test.fail` as #37 is), promoting the E2E step to a required check, and the two cases that need human evaluators (NFR-USA-002/STC-NFR-022 accessibility evaluation, STC-NFR-024 error-message review). Those two stay "not run" in D07 with that reason.

## Cases

Grouped by use case. "Layer" is where the system test will live: **UI** = Playwright in a browser, **API** = Playwright `request` against the stack (no browser), **mixed**. "Likely covered?" is a first pass from the existing E2E titles on `main` (`admin`, `auth`, `chat-files`, `chat-links`, `file-manager`, `floating-windows`, `follow`, `location`, `safety`, `tree`, `tabs`, …) and is verified, not trusted, in milestone 0.

| Group | Cases (D07 id, FR) | Layer | Likely covered by an existing E2E? |
| --- | --- | --- | --- |
| Workspace and auth | STC-010-003/004 (FR-010-02 400/409), STC-011-005 (FR-011-04 400/409), STC-020-004 (FR-020-04 redirect), STC-020-007 (password not exposed), STC-020-008 (capacity and re-entry), STC-040-005 (duplicate session cleanup) | API, a few UI | `auth.e2e.ts` covers takeover and two tabs (partly 040-005); `admin.e2e.ts` covers FR-011-04..06 happy path |
| Documents and tree | STC-021-002/003/004 (FR-021-01..04 sub-document, duplicate name suffix, empty name), STC-023-002/005/006 (FR-023-02/05/06 sibling duplicate, delete with children, delete confirmation) | mixed | `tree.e2e.ts` covers create/rename/move/delete on the happy path; `safety.e2e.ts` covers cancelling a file block's deletion |
| Blocks | STC-022-002 (FR-022-01 Markdown shortcuts), STC-022-005 (FR-022-04 reorder, concurrent move), STC-022-012 (FR-022-06 occupancy), STC-022-013 (block link block), STC-022-016 (FR-022-13/14 server-side file validation) | UI, API for 016 | `markdown-paste.e2e.ts` covers pasted Markdown, not typed shortcuts; `chat-links.e2e.ts` covers a block sent to chat |
| Version history | STC-090-001/002/004/005/006 (FR-090-02..08 order and grouping, reserved name, snapshot read, empty-version restore guard, classification) | mixed | `table.e2e.ts` covers a named revision and restore for tables only |
| Focus (presentation) | STC-030-004/005 (FR-030-07/09), STC-030-007/008/009/010 (FR-030-02/12/13/03 anchor, highlight limits, follower view, share button condition) | UI | `follow.e2e.ts` covers start, pause, resume and end notice |
| Chat, files, viewer, floating view | STC-060-002/004/007 (FR-060-01/05/03), STC-050-004..007 (FR-050-01/03/04 response rules, inline-unsafe types, list API auth, Yorkie failure), STC-061-002/004 (FR-061-02/04), STC-070-003..006 (FR-070-02/03/05), STC-080-002/003/004 (FR-080-02/04/05) | mixed | `chat-files.e2e.ts`, `file-manager.e2e.ts`, `floating-windows.e2e.ts`, `chat-links.e2e.ts` touch these paths; the response-header, auth and failure cases are API |
| Non-functional | STC-NFR-028 (Edge), STC-NFR-029 (block extension structure), STC-NFR-030 (module structure, log, impact), STC-NFR-023 (occupancy/location colour) | run / inspection | Edge: Playwright `msedge` channel (installed on the rig). 029/030: an inspection with cited code and log lines. 023: a UI assertion with the occupancy cases |

STC-030-007 ("anchor round trip, deleted block is null") and STC-030-008 (point/segment caps and TTL) are pure functions today. Their system-level form is the observable result (a follower lands on the same block after a scroll; the highlight stops at the cap and expires), and where the browser cannot reach a limit that the unit test pins, the case stays lower-level with that reason written in the table below instead of a test that proves nothing.

## Plan and trade-offs

- **One task, one PR, six milestones, a commit per milestone.** The user chose one task doc for all 46. The milestones keep the diff reviewable commit by commit.
- **Playwright `request` for the API-shaped cases, not new `scripts/verify-*.mjs` probes.** The cases are status codes, redirects and headers on the running stack, and `e2e/` already runs on the CI container-smoke stack. A new probe script would need its own wiring and would not appear in the E2E report. Cost: they ride the non-blocking E2E step. The existing probes keep covering what they cover.
- **Reuse `e2e/fixtures.ts` and `helpers.ts`** (`users`, `joinForm`, `createDocument`, `openDocument`, `online`, `block`, `blockValues`, `openChat`, `sendChat`). A new helper only where two milestones need the same step.
- **A defect found is not fixed here.** The test is written against the SRS behaviour. If it fails, it is marked `test.fail` with an issue link (the `recovery.e2e.ts` pattern) and recorded in D07 as a failure, so the report states what the product does.
- **Not every case becomes a browser test.** A case whose only observable form duplicates an existing E2E is recorded as covered by that test, named, and not copied.

## Milestones

### 0. Audit: what each case already has

- **What**: for each of the 46 cases, read the existing E2E and mark it covered (name the test), needs a new test, or stays lower-level (with the reason). Fill the table in this doc.
- **Files**: this task doc only.
- **Reuse**: the "Likely covered" column above and `docs/testing.md`.
- **Done**: every case has one of the three marks and the new-test list is the size the later milestones assume. If it is much smaller than 46, say so here before building.

### 1. Workspace, auth, documents and tree

- **What**: system tests for the workspace/auth and documents/tree rows of the table.
- **Files**: `e2e/workspace-limits.e2e.ts` (API: 400/409, redirect, capacity, no password in the join form), `e2e/tree.e2e.ts` or `e2e/documents.e2e.ts` (sub-document, duplicate and empty names, delete with children and confirmation).
- **Reuse**: `fixtures.ts`, `auth.e2e.ts`'s join flow, `tree.e2e.ts`'s tree helpers.
- **Done**: each case has a passing test that fails when the behaviour is removed (checked once by hand per file, recorded below).

### 2. Blocks

- **What**: typed Markdown shortcuts, block reorder (including two users moving at once), occupancy marks and their expiry, block link block, server-side file validation.
- **Files**: `e2e/blocks.e2e.ts`, plus API cases next to `safety.e2e.ts`.
- **Reuse**: `collaboration.e2e.ts` for two-client convergence, `markdown-paste.e2e.ts` for block assertions.
- **Done**: as milestone 1.

### 3. Version history

- **What**: list order and date grouping, reserved name rejected (a near-match allowed), snapshot read with a damaged entry skipped, empty-version restore guard, auto/pre-restore/named classification.
- **Files**: `e2e/history.e2e.ts`.
- **Reuse**: the revision preview and restore steps in `table.e2e.ts`.
- **Done**: as milestone 1. A damaged snapshot entry is only reachable through the API; if the stack cannot produce one, that sub-case stays lower-level and says so.

### 4. Focus (presentation)

- **What**: the presenter changes documents and the follower follows (a follower's own move pauses), pause then leave without notice, the share button's visibility condition, the follower sees only its target's highlight, highlight caps and expiry, and the anchor behaviour in its observable form.
- **Files**: `e2e/follow.e2e.ts` (extend) or `e2e/focus.e2e.ts`.
- **Reuse**: `follow.e2e.ts`'s share/follow helpers. Mind the harness lesson from the perf present-race task (`20261118-perf-present-race`): no check-then-click on UI another client can change.
- **Done**: as milestone 1.

### 5. Chat, files, viewer and floating view

- **What**: chat input validation and save-then-broadcast, a deleted document's link, the file API's response rules and auth, Yorkie-failure listing, sender/time labels and download, floating-window size/position limits, saved window state, a deleted document's view, viewer format detection, unsupported formats and closing.
- **Files**: `e2e/chat-validation.e2e.ts`, `e2e/files-api.e2e.ts`, `e2e/viewer.e2e.ts`, `e2e/floating-windows.e2e.ts` (extend).
- **Reuse**: `chat-files.e2e.ts`, `file-manager.e2e.ts`, `floating-windows.e2e.ts`, `network.ts` for a Yorkie failure.
- **Done**: as milestone 1. STC-050-007 needs the stack's Yorkie made unavailable; if that cannot be done inside the disposable stack without disturbing other tests it is run by hand, recorded as such, and the gap is named.

### 6. Edge, inspection items and the report

- **What**: run the E2E suite on Edge (`msedge` channel) and record the result for STC-NFR-028; write the inspection notes for STC-NFR-029 and 030 (block registry and the table block as an extension case, module boundaries, which events and errors are logged, and what a new collaboration feature touches), each claim tied to a file and line; update D07 §6/§7.7 once this merges.
- **Files**: `playwright.config.ts` (an Edge project only if it is cheap and not left on by default), this task doc for the inspection notes.
- **Reuse**: `docs/adr/`, `docs/design/architecture.md`, the existing registry tests.
- **Done**: an Edge run result with test counts, and two inspection write-ups. A claim the code does not support is reported as a finding, not softened.

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior.

- Vitest (logic / component / server / route): no change. These 46 cases already pass there (D07 appendix 7.2); the task adds the missing system level above them.
- Browser E2E (`e2e/`): this is the task. New spec files per milestone as above, reusing `fixtures.ts`. Each new test is shown once to fail when the behaviour is broken (a one-line local mutation, reverted) so it is not a test that cannot fail.
- Container smoke (`.github/workflows/ci.yml`): no change. The E2E step already runs on that stack. If suite time grows past what CI tolerates, say so here and split the slow cases with `@slow`.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] Milestone 0 table is complete: all 46 cases are marked covered / new test / stays lower-level, each with its reason or test name.
- [ ] Each case marked "new test" has a passing system test, or a `test.fail` with an issue link and an entry in D07's failures.
- [ ] Each new test was shown to fail on a deliberately broken behaviour, recorded below.
- [ ] STC-NFR-028 has an Edge run result; STC-NFR-029 and 030 have cited inspection notes.
- [ ] `pnpm e2e:isolated` passes locally, with the observed counts recorded (E2E on this repo ran 35 tests in about 3.4 min on `main` 475fa10; record the new total and time).
- [ ] `pnpm lint` and `pnpm typecheck` pass; required test changes are included, and gaps are recorded above.
- [ ] D07 draft updated after merge: the 46 rows move from "lower-level only" to their new results and the §6 summary counts change.

## Cross-cutting

- Requirements: each test names its FR/NFR in the title as `admin.e2e.ts` does (`(FR-011-07)`).
- The run recipe for the disposable stack is `docs/testing.md` ("E2E"); on the author's WSL machine Docker Desktop has to be started and a `docker` shim is needed, which is a local setup, not a repo change.
- E2E leaves `e2e-` members and documents behind on a shared stack; these tests use the isolated stack (`pnpm e2e:isolated`).
- No SRS or design doc changes. A defect that the tests find gets an issue; it does not widen this task.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
