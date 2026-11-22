# System tests for the requirements the D07 test report left unexercised

**Created**: 2026-11-18
**Issue**: none yet. The 55 cases are the D07 draft's "lower-level only" rows (§6) and its no-test rows (§7.7); open one if the team wants it tracked.
**Design**: none. This adds tests, not behaviour. The behaviours under test are in [`docs/SRS-en.md`](../../../../docs/SRS-en.md) and the design docs each case's FR points at.

## What this is

The D07 software system test report counts 144 cases. 57 were not run at system level: **46** pass only at the unit/component layer (44 FR rows plus NFR-023 and NFR-029), and **11** have no test at all. This task takes the 46 to a system test (the container plus a real browser, or the HTTP API of the running stack, as `e2e/` already does) and writes or runs what it can of the 11: nine of them. The goal is a PASS or a recorded FAIL for each case against a running stack, not a green unit layer.

**55 cases are in scope**: the 46, plus STC-020-009, 022-017, 022-018, 030-011, 070-006, 090-007, 090-008, NFR-028 and NFR-030. The first draft of this doc listed only 070-006, 028 and 030 of the 11 and counted 070-006 inside the 46; the audit below corrects that.

Out of scope: fixing defects it finds by default (each gets its own issue, and a known one is marked `test.fail` as #37 is; the exceptions, #273 and #276, are below), promoting the E2E step to a required check, and the two cases that need human evaluators (STC-NFR-022 accessibility evaluation, STC-NFR-024 error-message review). Those two stay "not run" in D07 with that reason.

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
| STC-090-005 | FR-090-08 | lower | The restore button is disabled for a version with no blocks (`version-history.tsx`). Milestone 3: a version with zero blocks cannot be made through the editor. Opening a document seeds a block when the list is empty (`use-block-document.ts`), the editor keeps a trailing empty block (`ensureTrailingEmptyBlock`), and the only way to save is from an open editor. Stays with `version-history.test.tsx` | none |
| STC-090-006 | FR-090-03/04 | new | A named version and the 복원 전 version a restore writes are reachable. Milestone 3: the stack does produce Yorkie's automatic revision (the project's snapshot threshold is 500 changes), so 560 typed characters give one and the automatic kind is tested too | `history.e2e.ts` |
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

- **The join route answers 500 where it means 400 and 503 (STC-020-008, found by the new cap test).** A blank nickname, a 21-character nickname and a new nickname at the 64-member cap all return 500 ("입장하지 못했습니다") in the container; the route maps them to 400, 400 and 503. The new nickname is still refused, so D07's expected result ("새 닉네임 거부") holds, but not the status or the message. Issue [#273](https://github.com/CBNU-TeamH/RMF-Block/issues/273), the likely cause is the registry's error classes coming from a second copy of `lib/auth/types.ts` (the server loads it as native ESM, the route bundle has its own). **Fixed in this task** (the user's call): `lib/auth/types.ts` now recognises the three errors by an explicit `name` through `Symbol.hasInstance`, so an error thrown by the other copy of the module still matches the route's `instanceof`. The route and the registry are unchanged. Unit test `lib/auth/types.test.mts` (fails without the fix: checked), and the two lifecycle tests that were `test.fail` are now ordinary tests (503 with the cap message; 400 for a blank and a 21-character nickname). STC-020-008 is PASS in full.

- **A restore reaches the peer joined to the text it replaced (STC-090-007, found by the new restore test).** After A restores a version, B's block reads e.g. `원래 문장바뀐 문장` until B reloads; the stored document is right. `replaceBlocks` keeps the block ids and only the restoring browser bumps `restoreCount` (part of every row's key), so the peer's rows stay mounted and the text insert that follows is patched onto their old value. Issue [#276](https://github.com/CBNU-TeamH/RMF-Block/issues/276). **Fixed in this task** (the user's call, 2026-11-22). The peer now recognises the replacement (`replacesBlockList`, a `set` of `blocks` at the root), bumps `restoreCount` too, and reads edits from the document until its rows have remounted (`use-block-document.ts`). Unit test in `text-surface.test.mts`. The E2E failed before the fix (checked) and passes after it, and the existing restore and collaboration specs still pass (`table`, `tabs`, `collaboration`, `sync`, `floating-windows`: 15/15).
- **STC-022-016's expected result is stricter than the design.** D07 says a disguised upload is rejected. The document upload route stores a file under the type its bytes show and falls back to `application/octet-stream` (`app/api/documents/[id]/files/route.ts`), and the preview route then answers 404 for it. The SRS (FR-022-13/14) does not ask for rejection. The test will assert what the design does (413 over 25 MB, 400 empty, a disguised file stored opaque and never previewable). **Decision (2026-11-18, the user): align D07 with the design**, not reject. The D07 expected result becomes "정상 저장, 경계 초과 거부, 위장 형식은 불투명 형식으로 저장되어 미리보기 불가"; the edit is made with the D07 update at the end of this task, and no issue is opened.
- **Confirmed (2026-11-18, the user): four cases live on the lifecycle stack and are not in CI** (010-003, 011-005's 409, 020-008, 050-007); their results are recorded from a local `--lifecycle` run.
- **STC-020-009 has no CI home.** `verify-auth.mjs` is run by hand; the task records one run and does not wire it into CI.

## Plan and trade-offs

- **One task, one PR, six milestones, a commit per milestone.** The user chose one task doc for all of them. The milestones keep the diff reviewable commit by commit.
- **Playwright `request` for the API-shaped cases, not new `scripts/verify-*.mjs` probes.** The cases are status codes, redirects and headers on the running stack, and `e2e/` already runs on the CI container-smoke stack. A new probe script would need its own wiring and would not appear in the E2E report. Cost: they ride the non-blocking E2E step. The existing probes keep covering what they cover.
- **Reuse `e2e/fixtures.ts` and `helpers.ts`** (`users`, `joinForm`, `createDocument`, `openDocument`, `online`, `block`, `blockValues`, `openChat`, `sendChat`). A new helper only where two milestones need the same step.
- **A defect found is not fixed here, unless the user says so.** The test is written against the SRS behaviour. If it fails, it is marked `test.fail` with an issue link (the `recovery.e2e.ts` pattern) and recorded in D07 as a failure, so the report states what the product does. **Exceptions, the user's calls: #273** (milestone 1, 2026-11-18; its `test.fail` markers are removed) **and #276** (milestone 3, 2026-11-22) are fixed in this task. Any later defect is decided the same way, case by case.
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

Use [the test-selection workflow](../../../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior.

- Vitest (logic / component / server / route): no change. The 46 lower-level cases already pass there (D07 appendix 7.2); the task adds the missing system level above them, and the nine no-test cases get their first test at the system level.
- Browser E2E (`e2e/`): this is the task. New spec files per milestone as above, reusing `fixtures.ts`. Each new test is shown once to fail when the behaviour is broken (a one-line local mutation, reverted) so it is not a test that cannot fail.
- Container smoke (`.github/workflows/ci.yml`): no change. The E2E step already runs on that stack. If suite time grows past what CI tolerates, say so here and split the slow cases with `@slow`.
- Commands and observed results (fill in before the PR):

  **Milestone 1** (2026-11-18, base `upstream/main` f81929e, isolated stacks via `pnpm e2e:isolated`):

  - Baseline: `e2e/auth.e2e.ts` 3/3 pass on this machine (WSL, Docker Desktop, Playwright 1228).
  - `e2e/documents.e2e.ts` (5 tests: 021-002, 021-003, 021-004, 023-002, 023-005) and `e2e/workspace-limits.e2e.ts` (3 tests: 010-004 + 011-005's 400 half, 020-004, 020-007): **8/8 pass** (about 11 s of test time).
  - `e2e/lifecycle/lifecycle.e2e.ts`, `pnpm e2e:isolated --lifecycle`: new tests for 010-003 + 011-005's 400/409 half (before setup) and 020-008 (cap) added; full file **8 tests: 6 pass, 2 expected failures** (the two `test.fail`, below) before the #273 fix; **8/8 pass after it** (58 s), including the kill/restart tests.
  - **Mutation check** (each break reverted afterwards, `git diff app lib` is empty): all 8 ordinary tests failed on the one-line break they guard, for the intended reason (parent check removed: 201 instead of 400; unique-name suffix removed; `trim()` removed; rename clash check removed; delete limited to the root; second setup accepted: 204 instead of 409; `/join` redirect removed; `name="password"` on the field: `/join?password=…` in the address). The lifecycle tests failed on a password-change 409 turned off (204 instead of 409), on the minimum length lowered to 1 (204 instead of 400), and on `MAX_MEMBERS` raised to 1000 ("70 new nicknames should have run into the cap").
  - STC-020-009: `scripts/verify-auth.mjs` run against a fresh isolated stack, **all 9 cases agree** (direct attach and invented token refused; join without or with a wrong password, token without a session and with a forged cookie 401; correct join 200, token issued, attach with it works). Not in CI.
  - **One flake, not caused by this change**: in the first full lifecycle run, the existing "after the app and Yorkie are killed" test (NFR-SAF-003) failed at its last `openDocument` (28 s, no block within 15 s); the same file passed on the immediate rerun (14.7 s for that test). No code of that test or of the product was touched. Recorded, not investigated.
  - **#273 fix**: `lib/auth/types.test.mts` 2/2 (and 70/70 across `lib/auth` and the join route's tests); it fails on the unfixed `types.ts` (checked). The kill test that flaked once passed in this run too.
  - `pnpm exec tsc --noEmit -p tsconfig.typecheck.json` is clean. The image build runs `pnpm build`, which type-checks `e2e/`; a duplicate `join` name in the lifecycle file broke a build once and was fixed.

  **Rebase** (2026-11-22): the branch now sits on `upstream/main` 94d9d03 (Yorkie and the SDK 0.7.28, the table block, block selection delete and the floating block group). Only the generated `tasks/README.md` conflicted.

  **Milestone 2** (2026-11-22, base 94d9d03): `e2e/blocks.e2e.ts` (022-002, 022-005, 022-012 + 022-018 + NFR-023 in one test, 022-013, 022-017) and `e2e/files-api.e2e.ts` (022-016): **6/6 pass** on an isolated stack. The occupancy test takes about 35 s because it waits out the 30 s heartbeat limit; the mark went after 25–45 s, as the 5 s tick allows.

  **Milestone 3** (2026-11-22): `e2e/history.e2e.ts`, 4 tests: list, reserved names, preview and the named kind (090-001/002/004/006); the automatic kind (090-006, 560 typed characters pass Yorkie's 500-change snapshot); restore and failed restore (090-007, the failure induced by aborting `GetRevision`); revision calls without a token (090-008). **4/4 pass after the #276 fix**; before it, the restore test failed on the peer's text. 090-008 replays the exact `ListRevisions`, `GetRevision` and `CreateRevision` requests a member's browser sent, from outside the browser: without the token and with an invented one Yorkie answers 401, with the token 200. A made-up document id is no use here: Yorkie answers 404 for an unknown document before it checks the token (probed).

  **Mutation check, milestones 2 and 3** (two builds, each break reverted, `git diff app lib` back to the #276 fix only). Build A, all 10 tests failed at the assertion that guards their break:
  - `> ` no longer converts (the block reads `> 인용`)
  - drop always lands after (first move)
  - heartbeat limit 3 s (mark already gone 5 s after leaving)
  - pasted address not detected (no link block)
  - PDF not sniffed (no iframe)
  - empty-file check removed (201 instead of 400)
  - snapshot name allowed (no alert)
  - automatic revision not classified (no 자동 저장 entry)
  - revision taken before the fetch on restore (2 복원 직전 상태 entries after a failed restore)
  - webhook allows a missing token (`ListRevisions` 200 instead of 401)

  Build B, the four it targeted failed:
  - occupancy border in a fixed colour (`rgb(0, 0, 0)` instead of the occupant's)
  - the claimed MIME type trusted (disguised file stored as `image/png`)
  - list sorted oldest first
  - 복원 전 kind dropped (no 복원 직전 상태 entry)

  The preview-order break was not reached in build B (the same test failed earlier, on the order), so it rides the milestone 4 build.

  **Milestone 4** (2026-11-22): `e2e/focus.e2e.ts`, 2 tests: the follower follows the presenter to another document, pauses on its own move and leaves quietly (030-004, 030-005); and with three people, 공유하기 only while nobody shares, a follower drawing only its presenter's marks, and the marks gone at the share's end (030-010, 030-009, 030-011). **2/2 pass**, and 3/3 again in the clean repeat below.
  - The second test needs two presenters at once, the state two crossing clicks produce. The first version cut the second presenter off from Yorkie (`yorkieCut`) while it pressed 공유하기, and failed in 3 of 4 runs on one stack at the third user's share card. The cut drops that presenter from the others' rosters (`2명 접속 중`, logged), and a member who comes back already presenting is by design not a share that started (`focus-follow-provider.tsx:108-116`); whether it came back presenting depended on which of its watch and its presence change landed first. The test now holds only that page's `PushPullChanges` with `page.route` and keeps its Watch streams open (`holdSync`), so it never leaves the room and its share arrives as a start. No CDP, so no `chromiumOnly`.
  - The presenter's own screen clears by construction: outside a share the overlay draws only what it received (`ink-overlay.tsx:431`). Removing `setMine([])` therefore changes nothing on screen, and the test asserts that screen only as the requirement's other half.

  **Mutation check, milestone 4** (in the milestone 5 builds below):
  - the presenter's document change not followed (`router.push` removed): the follower stays on the first document
  - the follower's own move not pausing (`pause()` removed): no 일시 정지됨
  - 공유하기 offered beside a presenter (`if (presenter)` short-circuited): 공유하기 still shown after the first share
  - `inkFrom` drawing the presenter not followed: the follower shows none of its presenter's marks
  - the version preview reversed (the break carried over from milestone 3): `첫째 둘째 셋째` not in order
  - the follower keeping the last marks it received (`setReceived` only for a non-null value): marks still on the follower after the share ended in 2 of 4 runs. In the other two the presenter's `marks: null` publish (`ink-overlay.tsx:283-285`) cleared them first; the two paths are by design, and the break removes one.

  **Milestone 5** (2026-11-22): 
  - `e2e/chat-validation.e2e.ts`: a blank message and one past 2000 characters refused, by the API (400 with the reason; exactly 2000 is accepted) and the send button; over the limit the message stays on screen with 전송 실패 · 다시 보내기 (060-002). A link to a deleted document keeps its sent name, dimmed and disabled, with 삭제된 문서 (060-007).
  - `e2e/files-api.e2e.ts`, two more: how a file is served (050-004) — a PNG inline as `image/png` with `filename*` carrying the Korean name, SVG and HTML 404 on preview, every download `application/octet-stream` as an attachment, `nosniff` and `private, max-age=3600` on both. And 401 `no workspace session` for the list, a preview and a download without a session (050-006).
  - `e2e/viewer.e2e.ts`: the chat file list's kind, size, sender and time (061-002); a file that cannot be shown in place gets no 미리보기 in the chat list or the file manager, and its 내려받기 hands over the same bytes (050-005, 080-003); 미리보기 for PNG, JPEG, GIF, WebP and PDF and not SVG or HTML, and a page claimed as a PNG served as `image/png` with `nosniff` and drawn as a broken image with no script run (080-002); the viewer closed by 닫기, the backdrop and Esc (080-004).
  - `e2e/floating-windows.e2e.ts`, four more: the corner keeps the ratio, stops at the 120 px floor and the window, and a smaller window pulls the view back inside (070-003); a damaged saved list restores only its whole entries, one each, and a list that is not JSON opens nothing (070-004); a restored view of a deleted document says so only once the catalogue answers — with `GET /api/documents` held it does not (070-005); a view survives its document moving and shows another user's edit live (070-006).
  - `e2e/lifecycle/lifecycle.e2e.ts`, one more: with Yorkie paused (`compose pause yorkie`) the file manager still lists the chat's files, says why the rest are missing, and recovers on 다시 시도 once Yorkie is back (050-007). The full lifecycle file, `pnpm e2e:isolated --lifecycle`: **9/9 pass** (49.5 s).
  - **All 12 shared-stack tests pass**, and with milestone 4's 2 and the existing tests of the same files, **51/51 over three repeats** (`--repeat-each=3`, one worker as configured). A first repeat with two workers failed five tests on 401s and documents that never opened: the fixture's nicknames are per run, not per worker, so parallel tests kicked each other's session. Not a product or test fault; `workers: 1` is the config.
  - A file name carrying CR/LF never reaches a header: it breaks the multipart part and the upload is refused (400). Stripping one from a stored name is `serving.ts`'s, which its unit test covers; 050-004 asserts the 400.
  - **STC-080-002 is aligned with the design, as 022-016 was.** A chat upload keeps the type its sender claimed (`app/api/chat/files/route.ts`), so a page claimed as a PNG is offered 미리보기. The defence is `nosniff` with the claimed image type, so the browser draws a broken image and never runs it (`docs/design/api.md`, "Files" → "Why preview and download are two endpoints": "an HTML file can be uploaded *as* `image/png` … shows a broken image instead of a page"). The D07 expected result ("허용 형식만 미리보기, 위장 파일은 표시되지 않음") is read as that; the D07 edit says so.

  **Mutation check, milestone 5** (three builds with milestone 4's, each break reverted, `git diff app lib` empty afterwards). Build A, all 14 targeted tests failed at their assertion (the lifecycle test in a `--lifecycle` run of the same build):
  - the 2000-character limit raised to 3000 (201 instead of 400)
  - the deleted link card enabled
  - `nosniff` dropped
  - the file list without a session check (200 instead of 401)
  - the sender dropped from the chat file row
  - 미리보기 offered for every chat file
  - SVG added to the inline types (offered for the SVG)
  - the backdrop click not closing the viewer
  - the corner floor lowered to 60 px
  - a saved list's duplicate entries kept (two windows)
  - a moved document read as deleted
  - the file manager's unavailable notice never shown (050-007)
  - plus the three milestone 4 breaks in this build

  Build B, the seven it targeted failed: the send button enabled for spaces, `Cache-Control: public`, a preview without a session check, the corner not stopped at the window, restored views shown as deleted before the catalogue answers (070-005 at its "not before" check; 070-004 and 070-006 failed on it too, as expected, and passed build A), plus the two milestone 4 breaks.

  **Milestone 6, Edge** (2026-11-22, Microsoft Edge 158.0.4370.33 on WSL, `E2E_BROWSERS=all pnpm e2e:isolated --project=msedge`; the `msedge` project is new in `playwright.config.ts`, opt-in like Firefox and WebKit): **80 tests, 71 pass, 8 skipped, 1 failed** (4.1 min). The 8 skipped are the specs that need a CDP session (`chromiumOnly()`), as on Firefox. The failure was the test, not the app: the NFR-SEC-001 join-form test required every request of the page to carry no query, and Edge asks for the favicon with a cache-busting one (`?favicon.<hash>.ico`), with no password or nickname in it. The test now looks at navigations only, which are what the address bar and the history keep; `workspace-limits.e2e.ts` passes 3/3 on Chromium and on Edge after that. Milestone 1's break for it (`name="password"` on the field, which navigates to `/join?password=…`) is a navigation, so the narrowed test still catches it. STC-NFR-028: PASS.

  **Milestone 6, inspection** (2026-11-22, on 972eb46; every claim cites the file and line it rests on).

  *STC-NFR-029 (NFR-MAI-003, an extensible structure for new block types).* The rule holds.
  - One table knows every block type: `BLOCK_KINDS` is typed `{ [K in BlockType]: Kind<K> }` (`lib/blocks/registry.ts:31`), so a type added to the union without an entry does not compile, as `registry.test.mts:22-23` records.
  - `Kind` ties a text-bearing type to the `text` surface at compile time (`registry.ts:24-29`), and `registry.test.mts:64-75` checks the same at run time.
  - Renderers branch on the surface, not the type (`editor.tsx:876-878`).
  - The extension case is the table block, the thirteenth type (PR #208, squashed as 01c1dca). It added one entry (`registry.ts:32`) and one surface (`registry.ts:13`), plus its own `table.ts` and `table-block.tsx`. It touched no module outside the editor and `lib/blocks`: not chat, files, auth, presence or the server.
  - "Without changing an existing block" is not literally true, and D07 should not claim it. `text-block.tsx` gained an optional `cellBinding` prop (`text-block.tsx:120`), so a cell reuses the text block's IME path. Its new branches run only when that prop is set (`text-block.tsx:230`, `:264`), so the other types take the path they took before. Their unit tests and E2E were not changed by #208 and still pass.

  *STC-NFR-030 (NFR-MAI-001, 002 and 004).*
  - **001, independent modules: holds.** Editing and sync live in `lib/blocks` and the document hooks over Yorkie; chat, file management and documents each have their own `lib/` module and API group (`docs/design/architecture.md` §1, §3). Imports between `lib/` modules run one way except one pair: `lib/blocks/markdown.ts:1` imports `documentLinkUrl` from `lib/chat/links.ts`, which imports the `Block` type back (`lib/chat/links.ts:1`). That is a type-level cycle through one helper, not shared state. Worth moving `links.ts` out of `chat/` some day; not a failure.
  - **004, a new collaboration feature touches little: holds.** The table block (above) is the evidence: a new CRDT-backed feature that touched the editor and `lib/blocks` only.
  - **002, logging major events and errors: partly.**
    - Errors are logged: every server route's catch-all (`app/api/chat/route.ts:92`, `app/api/documents/route.ts:82`, `app/api/documents/[id]/route.ts:125`, `:142`, `app/api/workspace/join/route.ts:62`, `app/api/files/route.ts:22`), the custom server's request, upgrade and socket errors (`server/index.mts:39`, `:81`, `server/ws-hub.mts:53`), and a damaged settings file (`lib/workspace-config.ts:71`) or members file (`lib/auth/session-registry.ts:118`).
    - Lifecycle events are logged: startup and the join address (`instrumentation.ts:78-94`, `server/index.mts:87`), the Yorkie auth webhook registration and the refusal to start without it (`instrumentation.ts:33-49`), and the admin password change (`lib/yorkie-admin.ts:177`).
    - Not logged on success: the workspace being set up, members joining, leaving or being removed, documents created, deleted or restored, and uploads. Whether those count as "major system events" is not settled by the SRS, which does not list them. **Decision (2026-11-22, the user): PASS with a note** — errors and lifecycle events are logged, and the unlogged success events are recorded as the note in D07. No issue.

  **Before the PR** (2026-11-22, on f27ded3): `pnpm e2e:isolated` **80/80 pass** on Chromium (5.7 min); `pnpm e2e:isolated --lifecycle` **9/9** (49.5 s, on 972eb46 — the lifecycle file has not changed since); `pnpm lint` and `pnpm typecheck` clean.

  **Review round** (2026-11-22): `/simplify` (four agents) and `/code-review low`. The code review found no correctness bug. From `/simplify`, applied:
  - `paste`, `PNG`, `dotColour` and `fileRow` moved to `e2e/helpers.ts` (three, two and two copies before), and `holdSync` to `e2e/network.ts`
  - the three auth errors folded into one `namedError` factory
  - the #273 and #276 comments cut to one line each, per `docs/conventions.md`
  - the lifecycle file's duplicated host bootstrap and join request shared, and the cap loop's flag dropped
  - the replay header handling in `history.e2e.ts`
  - `/files` loaded once in the 080-002 loop
  - one 25 MB buffer, not two
  - the 070-005 "not before" window 3 s → 1.5 s

  Declined:
  - clearing the handler maps instead of `replacingRef` (#276): less explicit, and already verified
  - new block ids on restore: they would break block links, floating views and focus anchors
  - reordering the ink draws to drop the 1.5 s wait: Yorkie does not order two clients' presence
  - a condition wait after the move in 070-006: a tree-nesting locator for one second
  - sharing helpers with `table`/`follow` specs: outside this diff

  After it: `pnpm e2e:isolated` **80/80** (5.4 min), `--lifecycle` **9/9**, the auth and text-surface unit tests 107/107, typecheck and eslint clean.

  **After the PR opened** (2026-11-22, found while mapping D07's traceability table): the restore test named FR-090-11 in its title but did not assert it. It now checks that the named version and the 복원 직전 상태 entry both show `· <nickname>`. Passes; with the description dropped from the list (`version-history.tsx`, `entry.description` short-circuited) it fails at that line. Reverted.

  **CodeRabbit on PR #277** (2026-11-22, review of 8bfa251, 6 inline + 1 nitpick). All seven taken:
  - `use-block-document.ts`: an edit landing after the replacing rows rendered but before the mark cleared was read into `blocks` and never reached the mounted row (`TextBlockView` reads `initialText` on mount). Such an edit now bumps `restoreCount` again, so the rows remount with it. The window is between a commit and its passive effects; not reproducible on purpose, so no test, and `history` stays green.
  - `blocks`: the concurrent reorder now accepts both converged orders — b resolves its drop target from its own view, so 하나 lands after 둘 or at the very top — and still needs both pages to agree.
  - `floating-windows`: the two fixed waits are gone. The deleted-view test checks once the catalogue has been asked (a pending route counts calls); the move test waits for the sidebar's new-parent chevron, which comes from the same socket message the floating views read.
  - `focus`: after pausing, the presenter now moves to a third document; the follower's sidebar dot shows the move arrived, and the follower stays put. After leaving, the presenter moves again for the same reason instead of a 1.5 s wait. The ignored presenter's ink is checked after that presenter takes a block, a later write from the same presence, so c must hold the marks by then.
  - `network.ts`: `holdSync` became `watchSync(page)`, which tracks PushPullChanges from when the page joins; its `hold()` returns only once no unheld request is pending.
  - `lifecycle`: the cap test reads the stored member count from the container and needs exactly `64 - stored` admissions.
  - Mutation checks, each reverted: inverted ink filter → fails at the ignored-ink line; a paused follower that still follows later moves → fails at the new URL check; floating names cleared on restore → fails at the no-notice line; `document:changed` read as deletion → fails after the sidebar wait; `MAX_MEMBERS = 63` → `Expected: 56, Received: 55`.
  - Runs: the four changed specs `--repeat-each=3` 51/51 (5.5 min); `--lifecycle` 9/9 (54.4 s).
  - Second CodeRabbit pass (review of 36ee588, 2 inline):
    - Taken: the replacing mark was cleared by the first remount's commit even while a second remount was queued, so an edit in between could be patched into rows about to be replaced from an older list. `remountsRef` now counts every remount asked for (the two peer paths and the local `replaceBlocks`), and the mark clears only when `restoreCount` has caught up with it. `history`, `collaboration` and `table` `--repeat-each=3`: 42/42.
    - Declined: making the cap test survive a rerun on the same stack. The lifecycle stack is single-use — `pnpm e2e:isolated --lifecycle` builds and removes it, and the file's first test needs a workspace nobody has opened — so `stored` is read from the run that filled it, and `names[0]` was admitted whenever `64 - stored` is positive.

## Acceptance

- [x] Milestone 0 tables are complete: all 55 cases have a mark, a basis and a home (2026-11-18).
- [x] Each case marked "new test" has a passing system test, or a `test.fail` with an issue link and an entry in D07's failures. (All pass; the two defects found, #273 and #276, were fixed here, so no `test.fail` remains. 090-005 moved to lower, see milestone 3.)
- [x] Each new test was shown to fail on a deliberately broken behaviour, recorded below.
- [x] STC-NFR-028 has an Edge run result; STC-NFR-029 and 030 have cited inspection notes.
- [x] `pnpm e2e:isolated` passes locally, with the observed counts recorded (E2E on this repo ran 35 tests in about 3.4 min on `main` 475fa10; now **80 tests in 5.4 min**, plus 9 lifecycle tests in 45.5 s).
- [x] `pnpm lint` and `pnpm typecheck` pass; required test changes are included, and gaps are recorded above.
- [x] D07 draft updated after merge: the 55 rows move from "lower-level only" or "not run" to their new results and the §6 summary counts change.

## Cross-cutting

- Requirements: each test names its FR/NFR in the title as `admin.e2e.ts` does (`(FR-011-07)`).
- The run recipe for the disposable stack is `docs/testing.md` ("E2E"); on the author's WSL machine Docker Desktop has to be started and a `docker` shim is needed, which is a local setup, not a repo change.
- E2E leaves `e2e-` members and documents behind on a shared stack; these tests use the isolated stack (`pnpm e2e:isolated`).
- No SRS or design doc changes. A defect that the tests find gets an issue; it does not widen this task.

## Review

- **Shipped** (#277, squash bcb73ec): system tests for 53 of the 55 cases, in the new specs `blocks`, `history`, `focus`, `chat-validation`, `viewer`, `documents` and `workspace-limits`, and in extended `files-api`, `floating-windows` and `lifecycle`. CI's E2E went from 35 tests to 80; `--lifecycle` has 9. An opt-in `msedge` project ran on Edge 158. Inspection notes cover NFR-029 and NFR-030 (NFR-MAI-002: pass with a note, the author's call).
- **Defects found and fixed here:** #273, where the join route answered 500 instead of 400 or 503, and #276, where a peer saw old and new text stuck together after a restore. Two CodeRabbit passes then tightened the #276 fix twice (see "Review round").
- **Cut, left at the lower level:** STC-090-005, because the editor cannot make a version with no blocks, and STC-030-008, because the ink caps need hundreds of pointer moves. Both have unit tests. NFR-022 and NFR-024 (user evaluation, the error-message sweep) stayed out of scope.
- **Found, not decided:** FR-080-05 asks for a notice on formats that cannot be previewed, and the app shows none. It only hides 미리보기 and offers 내려받기. Whether that is a defect or the design is the author's call. It is recorded in D07 §7.6, and no issue has been filed yet.
- **Moved on:** CodeRabbit's last follow-up on #277 (compare whole block lists in the concurrent reorder) arrived after the merge and went to #278. The D07 draft was updated outside the repository, because it is untracked. The NFR-PER re-measurement on two devices against the next release is separate work.
