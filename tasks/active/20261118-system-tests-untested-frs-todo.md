# System tests for the requirements the D07 test report left unexercised

**Created**: 2026-11-18
**Issue**: none yet. The 55 cases are the D07 draft's "lower-level only" rows (§6) and its no-test rows (§7.7); open one if the team wants it tracked.
**Design**: none. This adds tests, not behaviour. The behaviours under test are in [`docs/SRS-en.md`](../../docs/SRS-en.md) and the design docs each case's FR points at.

## What this is

The D07 software system test report counts 144 cases. 57 were not run at system level: **46** pass only at the unit/component layer (44 FR rows plus NFR-023 and NFR-029), and **11** have no test at all. This task takes the 46 to a system test (the container plus a real browser, or the HTTP API of the running stack, as `e2e/` already does) and writes or runs what it can of the 11: nine of them. The goal is a PASS or a recorded FAIL for each case against a running stack, not a green unit layer.

**55 cases are in scope**: the 46, plus STC-020-009, 022-017, 022-018, 030-011, 070-006, 090-007, 090-008, NFR-028 and NFR-030. The first draft of this doc listed only 070-006, 028 and 030 of the 11 and counted 070-006 inside the 46; the audit below corrects that.

Out of scope: fixing defects it finds (each gets its own issue, and a known one is marked `test.fail` as #37 is), promoting the E2E step to a required check, and the two cases that need human evaluators (STC-NFR-022 accessibility evaluation, STC-NFR-024 error-message review). Those two stay "not run" in D07 with that reason.

## Cases and audit (milestone 0)

Each case was checked against the E2E on `main` (`upstream/main` f81929e), the route and library code it exercises, and the unit tests that pin it. **Marks**: *covered* = an existing system test already asserts it (named); *new* = needs a system test; *new + lower* = a system test for the observable part, and a named remainder that stays at the lower level; *lower* = stays lower-level with the reason; *run* / *inspection* = no new code, the result is recorded. **Home** is the spec file and milestone that will hold it.

### 1. Workspace and auth (milestone 1)

| Case | FR/NFR | Mark | Basis | Home |
| --- | --- | --- | --- | --- |
| STC-010-003 | FR-010-02 | new | `lifecycle.e2e.ts` opens the workspace with a good password but never sends a short one. "Not opened" is only visible on an unopened stack | `e2e/lifecycle/` (API as host, before the setup step) |
| STC-010-004 | FR-010-02 | new | No spec calls `POST /api/workspace` again once open | `e2e/workspace-limits.e2e.ts` (host, shared stack): 409, old password still admits |
| STC-011-005 | FR-011-04 | new | `admin.e2e.ts` changes the password only on the happy path. The 400 half runs on the shared stack; the 409 "before opening" half needs the unopened stack | both files above |
| STC-020-004 | FR-020-04 | new | No spec visits `/join` while holding a session (`admin.e2e.ts` visits `/admin`) | `workspace-limits.e2e.ts` |
| STC-020-007 | NFR-SEC-001 | new | The native submit before hydration needs a context with JavaScript off | `workspace-limits.e2e.ts` |
| STC-020-008 | NFR-SEC-002 | new | The cap counts stored members, not live ones (`session-registry.ts`), so 64 joins fill the stack for every later test. It runs last on the lifecycle stack | `e2e/lifecycle/` (last) |
| STC-020-009 | NFR-SEC-005 | run | `scripts/verify-auth.mjs` exists and prints each case; CI runs only `verify-yorkie-invariants.mjs`. Run it against the isolated stack and record its output | no code; result in D07 |
| STC-040-005 | NFR-REL-004 | covered | `auth.e2e.ts` "two tabs of one session count once" and the takeover test (count is 2 after the displacement) | none |

### 2. Documents and tree (milestone 1)

| Case | FR | Mark | Basis | Home |
| --- | --- | --- | --- | --- |
| STC-021-002 | FR-021-02 | new | `tree.e2e.ts` moves a document under a parent; none creates one with `parentId` or sends a missing parent | `e2e/documents.e2e.ts` (API) |
| STC-021-003 | FR-021-03/04 | new | No spec creates two documents of one name | `documents.e2e.ts` (API) |
| STC-021-004 | FR-021-01 | new | No spec sends a blank or padded name | `documents.e2e.ts` (API) |
| STC-023-002 | FR-023-02 | new | `tree.e2e.ts` renames without a clash | `documents.e2e.ts` (API, `PATCH`) |
| STC-023-005 | FR-023-06 | new | `host.e2e.ts` restores one trash item; nothing deletes a document that has children | `documents.e2e.ts` (API + trash on `/admin`) |
| STC-023-006 | FR-023-05 | covered | `tree.e2e.ts` cancels the deletion (the peer still shows the row), then confirms it | none |

### 3. Blocks (milestone 2)

| Case | FR | Mark | Basis | Home |
| --- | --- | --- | --- | --- |
| STC-022-002 | FR-022-01 | new | `markdown-paste.e2e.ts` pastes Markdown; nothing types `# `, `- `, `> ` | `e2e/blocks.e2e.ts` |
| STC-022-005 | FR-022-04 | new | Reorder is HTML5 drag and drop in `editor.tsx` (the block menu has no move item); no spec drags a block. Two users moving at once is the second half | `blocks.e2e.ts` |
| STC-022-012 | FR-022-06 | new | No spec checks another user's occupancy mark. The 30 s heartbeat limit (`OCCUPANCY_TTL_MS`) is observable by waiting once | `blocks.e2e.ts`, one test with 022-018 and NFR-023 |
| STC-022-018 | FR-022-06 | new | the two-browser form of the same behaviour | same test as 022-012 |
| STC-022-013 | SRS 4.1 | new | `chat-links.e2e.ts` is a block sent to chat, not the block-link block | `blocks.e2e.ts` |
| STC-022-016 | FR-022-13/14 | new | `readUpload` and the document upload route answer 413 above 25 MB, 400 for empty, and record a file's type from its bytes. **A disguised file is not rejected: it is stored as `application/octet-stream`** (see Findings) | `e2e/files-api.e2e.ts` (API) |
| STC-022-017 | FR-022-13/14 | new | `file-manager.e2e.ts` uploads a PNG and asserts the image block; no spec uploads a PDF | `blocks.e2e.ts` (PDF; image is covered) |

### 4. Version history (milestone 3)

| Case | FR | Mark | Basis | Home |
| --- | --- | --- | --- | --- |
| STC-090-001 | FR-090-02 | new + lower | `table.e2e.ts` and `tabs.e2e.ts` open the panel. Order, date grouping and the end marker show with a few saved versions. Paging needs more than `REVISION_PAGE_SIZE` (50) versions: lower | `e2e/history.e2e.ts` |
| STC-090-002 | FR-090-07 | new | The save dialog shows `reservedLabelReason`; no spec types a reserved name | `history.e2e.ts` |
| STC-090-004 | FR-090-05 | new + lower | `table.e2e.ts` previews a real snapshot of a table. Text blocks in order are new. A damaged, duplicate or field-less entry cannot be produced through the UI: lower | `history.e2e.ts` |
| STC-090-005 | FR-090-08 | new | The restore button is disabled for a version with no blocks (`version-history.tsx`). Whether a version with zero blocks can be made through the editor is checked in milestone 3; if not, lower with that reason | `history.e2e.ts` |
| STC-090-006 | FR-090-03/04 | new + lower | A named version and the 복원 전 version a restore writes are reachable. Yorkie's own automatic label depends on its auto-revision setting: lower unless the stack produces one | `history.e2e.ts` |
| STC-090-007 | FR-090-09~11,13 | new | `table.e2e.ts` restores and checks the peer, but does not assert the 복원 전 version or a failed restore (induced by aborting the Yorkie request with `network.ts`) | `history.e2e.ts` |
| STC-090-008 | FR-090-12 | new | Revisions go through Yorkie; `verify-auth.mjs` shows a client without a session token cannot attach. The test sends a revision call with no token to the Yorkie RPC port (published on `127.0.0.1:8180` by `e2e-isolated.mjs`) and expects a refusal | `history.e2e.ts` (API) |

### 5. Focus (milestone 4)

| Case | FR | Mark | Basis | Home |
| --- | --- | --- | --- | --- |
| STC-030-004 | FR-030-07 | new | `follow.e2e.ts` scrolls within one document; none changes document | `e2e/focus.e2e.ts` |
| STC-030-005 | FR-030-09 | new | `follow.e2e.ts` ends the share from the presenter's side; none leaves while paused | `focus.e2e.ts` |
| STC-030-007 | FR-030-02 | covered + lower | `follow.e2e.ts` shows the follower landing within 8 px of the presenter's block after 재개. A deleted anchor block (`null`) is not reachable deterministically from the browser: lower | none |
| STC-030-008 | FR-030-12 | lower | The caps (600 points, 30 segments, 8 marks) need hundreds of pointer moves to reach, and the unit test pins the exact counts. The observable form (a mark reaches the follower, then is gone) is asserted with 030-011 | `ink.test.mts` stays |
| STC-030-009 | FR-030-13 | new | Needs a follower, the presenter and a third user | `focus.e2e.ts` |
| STC-030-010 | FR-030-03 | new | Needs one and then two other presenters | `focus.e2e.ts` |
| STC-030-011 | FR-030-12~14 | new | Ink is drawn as SVG polylines (`ink-overlay.tsx`), so the follower's marks are countable in the DOM, and gone after the share ends | `focus.e2e.ts` |

### 6. Chat, files, viewer, floating view (milestone 5)

| Case | FR | Mark | Basis | Home |
| --- | --- | --- | --- | --- |
| STC-060-002 | FR-060-01 | new | `chat.e2e.ts` sends a normal message. Over 2000 characters is `chat-service.ts` on the server; blank is also refused there | `e2e/chat-validation.e2e.ts` (API + UI) |
| STC-060-004 | FR-060-05 | covered + lower | `chat.e2e.ts` shows each message once on both sides. A failed save cannot be induced without breaking `.data`: lower | none |
| STC-060-007 | FR-060-03 | new | `chat-links.e2e.ts` opens a live link; none deletes the document first | `chat-validation.e2e.ts` |
| STC-050-004 | FR-050-03/04 | new | No spec reads a response header | `files-api.e2e.ts` (API) |
| STC-050-005 | FR-050-03/04 | new | `safety.e2e.ts` downloads a `.bin` but does not assert the missing preview | `e2e/viewer.e2e.ts`, shared with 080-003 |
| STC-050-006 | NFR-SEC-002 | new | `GET /api/files` with no cookie; "before Yorkie" is not observable and is not claimed | `files-api.e2e.ts` (API) |
| STC-050-007 | FR-050-01 | new | Needs Yorkie unreachable: `compose pause yorkie` on the lifecycle stack, as `lifecycle.e2e.ts` does for the app | `e2e/lifecycle/` |
| STC-061-002 | FR-061-02 | new | `file-manager.e2e.ts` checks the row's name and 채팅 origin, not the sender or time | `viewer.e2e.ts` |
| STC-061-004 | FR-061-04 | covered | `safety.e2e.ts` downloads a chat attachment by its link, byte for byte. The header rule is 050-004's | none |
| STC-070-003 | FR-070-02 | new | `floating-windows.e2e.ts` opens, orders, closes and caps windows; none drags a corner or shrinks the viewport | `floating-windows.e2e.ts` (extend) |
| STC-070-004 | FR-070-03 | new | `chat-files.e2e.ts` reloads a saved view; none damages the saved list first (it is in `localStorage`) | `floating-windows.e2e.ts` |
| STC-070-005 | FR-070-05 | new | A view of a document missing from the list, once with the list confirmed and once with it never arriving (`page.route` holds the request) | `floating-windows.e2e.ts` |
| STC-070-006 | FR-070-03/04 | new | no spec moves a document or edits the original while a view is open | `floating-windows.e2e.ts` |
| STC-080-002 | FR-080-02 | new | `chat-files.e2e.ts` previews a PNG; no PDF, no SVG or HTML | `viewer.e2e.ts` |
| STC-080-003 | FR-080-05 | new | the missing preview button and the download | `viewer.e2e.ts` (with 050-005) |
| STC-080-004 | FR-080-04 | new | `chat-files.e2e.ts` closes with the button only; backdrop and Esc are not covered | `viewer.e2e.ts` |

### 7. Non-functional (milestone 6, NFR-023 in milestone 2)

| Case | NFR | Mark | Basis | Home |
| --- | --- | --- | --- | --- |
| STC-NFR-023 | NFR-USA-003 | new | the occupancy colour and the presence dot, in the 022-012 test | `blocks.e2e.ts` |
| STC-NFR-028 | NFR-USA-005 | run | The Playwright `msedge` channel on the rig; the whole E2E suite, with the same CDP skips as Firefox | no code; result in D07 |
| STC-NFR-029 | NFR-MAI-003 | inspection | Registry rules (`lib/blocks/registry.ts`) and the table block as the case; each claim cited to a file and line | this doc |
| STC-NFR-030 | NFR-MAI-001/002/004 | inspection | Module boundaries, what is logged, and what a new collaboration feature touches; each claim cited | this doc |

### Result of the audit

- **Covered**: 3 (040-005, 023-006, 061-004). **Covered + lower**: 2 (030-007, 060-004). **Lower**: 1 (030-008). **Run or inspection**: 4 (020-009, 028, 029, 030).
- **New**: 45, of which 3 also keep a named lower-level remainder (090-001, 090-004, 090-006). The new-test count is about what the first plan assumed, not "much smaller than 46", so the milestones stay as written, with the nine no-test cases added to them.
- **Home in CI**: the shared-stack specs run in the E2E step. Four cases need a stack state the shared stack cannot give (an unopened workspace for 010-003 and 011-005's 409, a full member list for 020-008, a paused Yorkie for 050-007). They live in `e2e/lifecycle/`, which `pnpm e2e:isolated --lifecycle` runs and CI does not, so their result is recorded from a local run.

### Findings so far

- **STC-022-016's expected result is stricter than the design.** D07 says a disguised upload is rejected. The document upload route stores a file under the type its bytes show and falls back to `application/octet-stream` (`app/api/documents/[id]/files/route.ts`), and the preview route then answers 404 for it. The SRS (FR-022-13/14) does not ask for rejection. The test will assert what the design does (413 over 25 MB, 400 empty, a disguised file stored opaque and never previewable). **Decision (2026-11-18, the user): align D07 with the design**, not reject. The D07 expected result becomes "정상 저장, 경계 초과 거부, 위장 형식은 불투명 형식으로 저장되어 미리보기 불가"; the edit is made with the D07 update at the end of this task, and no issue is opened.
- **Confirmed (2026-11-18, the user): four cases live on the lifecycle stack and are not in CI** (010-003, 011-005's 409, 020-008, 050-007); their results are recorded from a local `--lifecycle` run.
- **STC-020-009 has no CI home.** `verify-auth.mjs` is run by hand; the task records one run and does not wire it into CI.

## Plan and trade-offs

- **One task, one PR, six milestones, a commit per milestone.** The user chose one task doc for all of them. The milestones keep the diff reviewable commit by commit.
- **Playwright `request` for the API-shaped cases, not new `scripts/verify-*.mjs` probes.** The cases are status codes, redirects and headers on the running stack, and `e2e/` already runs on the CI container-smoke stack. A new probe script would need its own wiring and would not appear in the E2E report. Cost: they ride the non-blocking E2E step. The existing probes keep covering what they cover.
- **Reuse `e2e/fixtures.ts` and `helpers.ts`** (`users`, `joinForm`, `createDocument`, `openDocument`, `online`, `block`, `blockValues`, `openChat`, `sendChat`). A new helper only where two milestones need the same step.
- **A defect found is not fixed here.** The test is written against the SRS behaviour. If it fails, it is marked `test.fail` with an issue link (the `recovery.e2e.ts` pattern) and recorded in D07 as a failure, so the report states what the product does.
- **Not every case becomes a browser test.** A case whose only observable form duplicates an existing E2E is recorded as covered by that test, named, and not copied.

## Milestones

### 0. Audit: what each case already has

- **What**: for each of the 55 cases, read the existing E2E, the route and library code and the unit test that pins it, and mark it covered (name the test), new, new + lower, lower, run or inspection (with the reason). Fill the tables in this doc.
- **Files**: this task doc only.
- **Reuse**: `docs/testing.md` and the unit tests D07 appendix 7.2 names.
- **Done**: every case has a mark and a home (the tables above), and the new-test count matches what the milestones assume: 45 new of 55, not much smaller. Done 2026-11-18.

### 1. Workspace, auth, documents and tree

- **What**: system tests for the workspace/auth and documents/tree rows (14 cases: 010-003/004, 011-005, 020-004/007/008/009, 021-002/003/004, 023-002/005; 040-005 and 023-006 are covered).
- **Files**: `e2e/workspace-limits.e2e.ts` (400/409, redirect, no password in the join form), additions to `e2e/lifecycle/lifecycle.e2e.ts` (short password before opening, 409 before opening, the 64-member cap last), `e2e/documents.e2e.ts` (parent, duplicate and blank names, rename clash, delete with children and the trash). `verify-auth.mjs` run and recorded for 020-009.
- **Reuse**: `fixtures.ts`, `auth.e2e.ts`'s join flow, `tree.e2e.ts`'s tree helpers.
- **Done**: each case has a passing test that fails when the behaviour is removed (checked once by hand per file, recorded below).

### 2. Blocks

- **What**: typed Markdown shortcuts, block reorder by drag (including two users moving at once), occupancy marks with their colour and 30 s expiry (022-012, 022-018, NFR-023 in one test), block link block, PDF upload, server-side file validation.
- **Files**: `e2e/blocks.e2e.ts`, `e2e/files-api.e2e.ts` (shared with milestone 5's response rules).
- **Reuse**: `collaboration.e2e.ts` for two-client convergence, `markdown-paste.e2e.ts` for block assertions.
- **Done**: as milestone 1.

### 3. Version history

- **What**: list order, date grouping and the end marker, reserved name rejected (a near-match allowed), a snapshot's text blocks in order, the empty-version restore guard, named and pre-restore classification, a restore (the 복원 전 version, the peer's screen, a failed restore leaving the document unchanged), and a revision call with no session refused.
- **Files**: `e2e/history.e2e.ts`.
- **Reuse**: the revision preview and restore steps in `table.e2e.ts`.
- **Done**: as milestone 1. A damaged snapshot entry is only reachable through the API; if the stack cannot produce one, that sub-case stays lower-level and says so.

### 4. Focus (presentation)

- **What**: the presenter changes documents and the follower follows (a follower's own move pauses), pause then leave without notice, the share button's visibility condition, the follower sees only its target's highlight, and a highlight reaches the follower and goes when the share ends. The caps (030-008) and a deleted anchor stay lower-level.
- **Files**: `e2e/follow.e2e.ts` (extend) or `e2e/focus.e2e.ts`.
- **Reuse**: `follow.e2e.ts`'s share/follow helpers. Mind the harness lesson from the perf present-race task (`20261118-perf-present-race`): no check-then-click on UI another client can change.
- **Done**: as milestone 1.

### 5. Chat, files, viewer and floating view

- **What**: chat input validation, a deleted document's link, the file API's response rules and auth, Yorkie-failure listing (lifecycle stack), sender/time labels, floating-window size/position limits, a damaged saved window list, a deleted document's view, a view that survives a move and shows an edit, viewer format detection, unsupported formats and closing by button, backdrop and Esc.
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

- Vitest (logic / component / server / route): no change. The 46 lower-level cases already pass there (D07 appendix 7.2); the task adds the missing system level above them, and the nine no-test cases get their first test at the system level.
- Browser E2E (`e2e/`): this is the task. New spec files per milestone as above, reusing `fixtures.ts`. Each new test is shown once to fail when the behaviour is broken (a one-line local mutation, reverted) so it is not a test that cannot fail.
- Container smoke (`.github/workflows/ci.yml`): no change. The E2E step already runs on that stack. If suite time grows past what CI tolerates, say so here and split the slow cases with `@slow`.
- Commands and observed results (fill in before the PR):

## Acceptance

- [x] Milestone 0 tables are complete: all 55 cases have a mark, a basis and a home (2026-11-18).
- [ ] Each case marked "new test" has a passing system test, or a `test.fail` with an issue link and an entry in D07's failures.
- [ ] Each new test was shown to fail on a deliberately broken behaviour, recorded below.
- [ ] STC-NFR-028 has an Edge run result; STC-NFR-029 and 030 have cited inspection notes.
- [ ] `pnpm e2e:isolated` passes locally, with the observed counts recorded (E2E on this repo ran 35 tests in about 3.4 min on `main` 475fa10; record the new total and time).
- [ ] `pnpm lint` and `pnpm typecheck` pass; required test changes are included, and gaps are recorded above.
- [ ] D07 draft updated after merge: the 55 rows move from "lower-level only" or "not run" to their new results and the §6 summary counts change.

## Cross-cutting

- Requirements: each test names its FR/NFR in the title as `admin.e2e.ts` does (`(FR-011-07)`).
- The run recipe for the disposable stack is `docs/testing.md` ("E2E"); on the author's WSL machine Docker Desktop has to be started and a `docker` shim is needed, which is a local setup, not a repo change.
- E2E leaves `e2e-` members and documents behind on a shared stack; these tests use the isolated stack (`pnpm e2e:isolated`).
- No SRS or design doc changes. A defect that the tests find gets an issue; it does not widen this task.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
