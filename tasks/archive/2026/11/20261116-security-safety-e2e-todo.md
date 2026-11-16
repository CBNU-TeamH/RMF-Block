# Security, safety and reliability E2E

**Created**: 2026-11-16
**Design**: [testing strategy](../../../../docs/testing.md), [chat links](../../../../docs/design/chat.md) ("Links": only `http(s)` becomes a link), [API](../../../../docs/design/api.md) (file serving).

The D07 system-test report counts only system-level evidence (browser E2E, container smoke, real-device perf). Three
non-functional requirements have no browser-level check yet: NFR-SEC-003, NFR-REL-003 and the cancel branch of
NFR-SAF-002 for files.

## Milestones

### 1. Hostile text stays inert (NFR-SEC-003)

- **What**: markup and script-shaped text typed into the places other users see it renders as literal text and runs nothing.
- **Files**: `e2e/safety.e2e.ts` (new).
- **Reuse**: `users` fixture, `createDocument`, `openDocument`, `insertAt`, `sendChat`, `openChat`, `joinForm`/`bootstrapHost`-style helpers in `e2e/helpers.ts`. The unit rules this proves in a browser: `lib/chat/links.ts` (`javascript:`/`data:` stay text), `lib/files/serving.ts`.
- **Done**: a payload set (`<img src=x onerror=…>`, `<script>…</script>`, `javascript:…`) in a document name, a block, a chat message and a nickname shows verbatim on a second user's screen; no `dialog` event fires and a page-global flag the payload would set stays unset; a `javascript:` URL in chat is not a link.

### 2. A transferred file keeps its bytes (NFR-REL-003)

- **What**: a file uploaded into a document and one sent in chat download as exactly the bytes that went in.
- **Files**: `e2e/safety.e2e.ts`.
- **Reuse**: the upload and download controls `file-manager.e2e.ts` and `chat-files.e2e.ts` already drive (`파일 추가` input, `내려받기` link, the chat 파일 tab).
- **Done**: random bytes larger than one chunk, SHA-256 of the downloaded file equals the SHA-256 of the upload, for both the document and the chat path.

### 3. Cancelling a file deletion keeps the file (NFR-SAF-002)

- **What**: the file block's inline two-step delete leaves the block when the second step is cancelled.
- **Files**: `e2e/safety.e2e.ts`.
- **Reuse**: `file-manager.e2e.ts` already confirms the deletion; the document-level cancel and confirm are in `tree.e2e.ts`. This adds only the cancel branch.
- **Done**: after 삭제 then 취소 the block is still there, still downloads, and a reload still shows it.

## Not in this task

- NFR-SAF-001 (auto-save): `collaboration.e2e.ts` already edits, reloads without any save action and sees the content. D07 cites that test instead of a duplicate.
- NFR-SAF-002 for documents: `tree.e2e.ts` already cancels, then confirms, a delete.
- NFR-SAF-003 and restart persistence: need a separate stack — the lifecycle task.

## Test selection

Use [the test-selection workflow](../../../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior.

- Vitest (logic / component / server / route): unchanged. The rules under test (`lib/chat/links.ts`, `lib/files/serving.ts`) already have unit tests; this task proves them in a browser against the running stack.
- Browser E2E (`e2e/`): new `e2e/safety.e2e.ts`; `docs/testing.md`'s E2E list gains the three behaviours.
- Container smoke (`.github/workflows/ci.yml`): no change; `scripts/verify-chat-files.mjs` already probes the wire headers.
- Commands and observed results (main `475fa10`, WSL2 + Docker Desktop, `pnpm e2e:isolated` flow): `e2e/safety.e2e.ts --repeat-each=3` 9/9 (after the CodeRabbit round: `<script>` payload, `e2e-` nickname, download after cancel, `--repeat-each=2` 6/6); the whole suite 38/38 (two `diagnostic:` expected failures, #37). `pnpm exec eslint e2e/safety.e2e.ts`, `tsc --noEmit`, `verify:docs` and the comment budget clean. Vitest untouched (no product code).

## Acceptance

- [x] `pnpm e2e:isolated` passes the new specs three times in a row, then the whole suite once.
- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm verify:docs` and the comment budget pass.
- [x] The specs leave no state a later spec could trip on (names and files carry the `e2e-` prefix the cleanup rules match).

## Cross-cutting

SRS: NFR-SEC-003, NFR-REL-003, NFR-SAF-002. No product code, API, type or storage change. If a payload does execute, that is a
product bug: stop, open an issue, and keep the spec as `test.fail` with the issue link, like the #37 diagnostics.

## Review

The three specs shipped as written; no payload executed and no product change was needed. Cut: NFR-SAF-001 and the document branch of NFR-SAF-002, already covered by `collaboration.e2e.ts` and `tree.e2e.ts`.
