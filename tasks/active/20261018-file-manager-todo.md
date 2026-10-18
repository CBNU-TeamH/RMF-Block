# Workspace file manager (UC-050)

**Created**: 2026-10-18
**Issue**: #164
**Design**: [File manager](../../docs/design/file-manager.md)

## Milestones

### 1. The list

- **What**: `GET /api/files` lists every file a live document block embeds, placed at its document and block, plus every chat attachment; a document upload no live block holds is left out (FR-050-01/02/06).
- **Files**: `lib/yorkie-admin.ts` (`readDocumentRoots`, `yorkieAdminAddr`), `lib/files/workspace-files.ts`, `app/api/files/route.ts`, `instrumentation.ts`.
- **Reuse**: the admin login and password from #200; `FileRepository.list`, `chatService.list`, the catalogue; `kindOf` from the chat file list.
- **Done**: on a real stack, an upload is listed once its block exists and drops off when the block is deleted; with Yorkie stopped, chat files still list and the response says so.

### 2. The page

- **What**: `/files` from a **파일** link at the sidebar's foot: 이미지/PDF/기타 tabs and a table of name, source, size, uploader and date, with 미리보기, 원본 위치 and 내려받기.
- **Files**: `app/(workspace)/files/`, `app/(workspace)/sidebar.tsx`.
- **Reuse**: the floating view (preview), the download route, the chat file list's row and tab styles.
- **Done**: the page lists, filters and previews as decided on #164.

### 3. Back to the source

- **What**: 원본 위치 opens a document at the block and highlights it, or the chat window at the message and highlights it (E3-3).
- **Files**: `focus-follow-provider.tsx` (`goToBlock`), `documents/[id]/use-focus-presence.ts`, `chat-window.tsx` (`useOpenChatAt`), `chat-panel.tsx`, `chat-message.tsx`, `layout.tsx`, `ui.tsx` (`flash`).
- **Reuse**: UC-040's scroll target and its follow confirmation.
- **Done**: both jumps land and highlight, including a chat landing out of the panel's file list.

### 4. After trying it: the preview window and the link's place

- **What**: 미리보기 opens a window centred over the dimmed page instead of a floating view, in the file manager and the chat file list, and a PDF block's 전체 화면 opens the same window; the 파일 link moves from the sidebar's foot to under 새 문서 (and after it on the rail).
- **Files**: `file-preview-dialog.tsx`, `files/file-manager.tsx`, `chat-files.tsx`, `documents/[id]/pdf-block.tsx`, `document-list.tsx`, `sidebar.tsx`.
- **Reuse**: the PDF block's 전체 화면 `<dialog>` (`showModal()`, backdrop, Esc), moved out of the block so all three open one window.
- **Done**: both lists preview an image and a PDF in the window; Esc, the backdrop and 닫기 close it, and Esc from the chat file list leaves the chat open.

## Test selection

- Vitest (logic / component / server / route): new `lib/files/workspace-files.test.mts` (placing, FR-050-06, trash, legacy uploads, duplicates, bad roots, Yorkie down, chat files, order), `app/api/files/route.test.ts` (gate, success, Yorkie down), `app/(workspace)/files/file-manager.test.tsx` (tabs, source, jumps, preview vs download, error and retry); extended `lib/yorkie-admin.test.mts` (`readDocumentRoots`), `focus-follow-provider.test.tsx` (`goToBlock`), `chat-panel.test.tsx` (landing).
- Browser E2E (`e2e/`): new `e2e/file-manager.e2e.ts` — a document image listed, jumped to and dropped after its block is deleted; a chat file opened at its message.
- Container smoke (`.github/workflows/ci.yml`): no change — startup, auth and networking are untouched; the Yorkie read is covered by the stack check below.
- Commands and observed results:
  - `pnpm typecheck`, `pnpm lint`: clean.
  - `pnpm test`: 76 files, 820 tests passed (24 new across the six test files above).
  - `pnpm comments`, `pnpm verify:docs`: clean; `gen-endpoints` rewrote the endpoint table.
  - `bash .githooks/pre-push` (budget, typecheck, test, production build): passed; `/files` and `/api/files` are in the build output.
  - Real stack, an isolated project built from this branch with Yorkie 0.7.23: signed out 401; an upload with no block not listed; listed once an image block holds it, with its document and block; a chat attachment listed with its message; newest first; dropped when the block is deleted; with Yorkie stopped, 200 with chat files and `documentsUnavailable`, and the failure logged — 10 of 10.
  - `e2e/file-manager.e2e.ts`: type-checked and collected by Playwright (2 tests); not run here — this machine has no Playwright browsers, so CI's E2E step runs it.
  - Milestone 4: new `file-preview-dialog.test.tsx` (image vs PDF, three ways to close, closed with no file); `file-manager.test.tsx` and `chat-files.test.tsx` open the window instead of a floating view; `document-list.test.tsx` reads the tree's links within its list, now that 파일 is a link above it. `pnpm typecheck`, `pnpm lint`, `pnpm comments`, `pnpm verify:docs` clean; `pnpm test` 77 files, 823 tests passed. In a browser on the isolated stack: the link under 새 문서 and on the rail, an image and a PDF previewed from `/files`, a chat image from the chat file list, closed by Esc and by the backdrop, the chat still open after Esc, a guest shown 파일 and not 관리자; a PDF block's 전체 화면 opened, closed by 닫기 and by Esc, and opened again. The maintainer tried the page by hand as well.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] On a real stack: listed once placed, dropped when the block is deleted, chat files listed, and Yorkie down degrades as designed.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm verify:docs`, `pnpm comments` pass.

## Cross-cutting

FR-050-01..06 (UC-050). Chat files are listed beyond UC-050's wording, recorded in the design doc;
the SRS is unchanged. `app-shell.md`, `chat.md`, `presence-and-focus.md` and `api.md` updated for
the sidebar link, the chat window wrapping the shell, `goToBlock` and the endpoint.

## Review

Filled in at the end.
