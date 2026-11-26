# Export a document as Markdown (.md / .zip) or print it to PDF

**Created**: 2026-11-25
**Issue**: none — requested by the maintainer after the exhibition; Markdown import exists, export does not.
**Design**: a new `docs/design/document-export.md` (milestone 0), linked from [app-shell.md](../../docs/design/app-shell.md) ("Tabs, then one bar for the document") and [document-editing.md](../../docs/design/document-editing.md) ("Selecting and copying blocks").

Benchmarked on Notion's ••• → Export ([help page](https://www.notion.com/help/export-your-content)): format choice, `Include subpages`, `Create folders for subpages`, `Include content`. Kept: Markdown, sub-page choice, PDF. Dropped: HTML/CSV, "exclude files", the folder toggle (always nested folders). Unlike Notion, a text-only document downloads as a bare `.md`, not a zip.

## SRS change (needs team agreement, AGENTS §5)

SRS-ko text below; SRS-en gets the same rows in the same place in the same PR (`verify-srs-sync`). **Review this wording before anything is built.**

UC-022 대안 흐름, E5 다음:

```
**E6. 문서 내보내기**
  1. 사용자 1이 문서 바의 내보내기 메뉴에서 Markdown 또는 PDF 인쇄를 선택한다.
  2. (Markdown) 하위 문서가 있으면 시스템은 하위 문서를 함께 내보낼지 묻는다.
  3. (Markdown) 시스템은 첨부 파일이 없고 함께 내보낼 하위 문서도 없으면 .md 파일 하나를, 그렇지 않으면 .md 파일과 첨부 파일·함께 내보낼 하위 문서를 묶은 .zip 파일을 내려받게 한다.
  4. (PDF) 시스템은 문서 내용만 남긴 인쇄 화면을 열어 브라우저가 PDF로 저장할 수 있게 한다.
```

§3.3.5 기능 요구사항 표, FR-022-14 다음:

| ID | 요구사항 | 관련 UC |
| --- | --- | --- |
| FR-022-15 | 사용자는 문서를 Markdown으로 내보낼 수 있어야 한다. 첨부 파일이 없으면 .md 파일 하나로, 이미지·파일 블록이 있으면 .md 파일과 첨부 파일을 묶은 .zip 파일로 내려받는다. | UC-022 |
| FR-022-16 | 시스템은 하위 문서가 있는 문서를 내보낼 때 하위 문서 포함 여부를 물어야 하며, 포함하면 문서 계층을 폴더 구조로 담은 .zip 파일을 만들고 내보낸 문서 사이의 링크를 상대 경로로 바꿔야 한다. | UC-022 |
| FR-022-17 | 사용자는 문서를 인쇄해 PDF로 저장할 수 있어야 하며, 시스템은 인쇄 시 사이드바·문서 바·채팅·플로팅 창·블록 조작 버튼을 숨기고 문서 내용 전체를 출력해야 한다. | UC-022 |

## Milestones

One PR, a commit per milestone, reported after each.

### 0. SRS + design doc

- **What**: the rows above land in SRS-ko and SRS-en; the design doc states the export layout, the naming rules, what is not exported (sub-pages in print, trashed documents) and the in-memory limit.
- **Files**: `docs/SRS-ko.md`, `docs/SRS-en.md`, `docs/design/document-export.md` (new), `docs/design/app-shell.md`, `docs/design/document-editing.md`.
- **Reuse**: the FR row format and UC alternative-flow format already in UC-022.
- **Done**: `pnpm verify:docs` clean (SRS sync and refs, ownership, links).

### 1. Export model in `lib/` (pure)

- **What**: given the catalogue, the root id, `includeSubpages`, each document's blocks and the file metadata, build the list of entries `{ path, text | fileId }` and whether a zip is needed.
- **Layout**:
  ```
  <문서명>.md                       ← alone when no files and no sub-pages
  <문서명>.zip
    <문서명>.md
    <문서명>/<첨부 파일명>
    <문서명>/<하위 문서명>.md
    <문서명>/<하위 문서명>/...
  ```
- **Names**: `\ / : * ? " < > |` and control characters become `_`, trailing dots and spaces are trimmed, a Windows device name (`CON`, `NUL`…) gets a leading `_`, empty → `제목 없음`, a repeat in one folder (case ignored, as Windows does) gets ` (2)`.
- **Links**: image/file blocks → relative path in the zip; a doc or block link to an exported document → its relative `.md`; any other link keeps the absolute URL from the request origin (`documentLinkUrl`, `lib/chat/links.ts`). A file that no longer exists is written as its name without a link.
- **Files**: `lib/documents/export.ts` + `export.test.mts`; `lib/blocks/markdown.ts` (one optional href argument; the clipboard caller keeps today's absolute URLs) + `markdown.test.mts`; `lib/blocks/revision-snapshot.ts` (factor the YSON unwrap so a `GetDocuments` root reaches `readBlocks` too).
- **Reuse**: `blocksToMarkdown` (all 13 block types), `readRevisionBlocks` / `readBlocks`, `subtreeIds` and `treeRows` (`lib/documents/tree.ts`) for descendants in sidebar order.
- **Spike first**: capture a real root from `readDocumentRoots` on the container and settle whether it parses as plain JSON (`workspace-files.ts` `placesOf`) or YSON (`readRevisionBlocks`).
- **Check**: whether the import (`markdown-import.ts`) reads the export back to the same blocks; if a blank-line join breaks that, the export follows the import's rules.
- **Done**: unit tests cover text-only → no zip, file → zip, sub-pages on/off, name collisions and illegal characters, relative links, a missing file.

### 2. Route `GET /api/documents/[id]/export?subpages=0|1`

- **What**: 401 without a member, 404 for an unknown or trashed id, 503 (Korean message) when Yorkie is unreachable; otherwise `text/markdown; charset=utf-8` or `application/zip` with `Content-Disposition` from `attachmentHeaders`.
- **Files**: `app/api/documents/[id]/export/route.ts` + test; `package.json` (fflate); `docs/design/api.md` (endpoint table via `node scripts/gen-endpoints.mjs`); `docs/adr/003-stack-choices.md` (a line for fflate).
- **Reuse**: `currentMember()`, `readDocuments()`, `readDocumentRoots(yorkieAdminAddr(), ids)` (one call for the subtree, as `GET /api/files` does), `fileRepository.read`, fflate `zipSync`.
- **Done**: a route test reads the zip back with `unzipSync` and checks names and bytes; headers checked for both shapes.

### 3. 내보내기 menu in the document bar

- **What**: a ··· button at the right end of the document bar, after version history, with **Markdown (.md)** and **PDF로 인쇄**. With no sub-pages Markdown downloads at once through an `<a download>`; with sub-pages a dialog asks "하위 문서 N개도 함께 내보낼까요?" — **이 문서만** / **하위 문서 포함**.
- **Files**: `app/(workspace)/document-export.tsx` + test; `app/(workspace)/layout.tsx` (mount it). It needs only the document id and the catalogue, both of which the layout already has (the way `Breadcrumb` reads them), so it is not portalled from the editor as version history is.
- **Reuse**: the `DocumentRowMenu` pattern (`document-row-menu.tsx`), dialog classes from `ui.tsx`, the sub-page count from the delete warning in `document-actions.tsx`.
- **Done**: component test covers both menu items, the direct link, the dialog and both its buttons, and `window.print` being called.

### 4. Print to PDF

- **What**: `window.print()` (Ctrl+P gives the same) prints only the document: `print:hidden` on the sidebar, tab strip, document bar, banners, chat, floating views, toasts, ink toolbar, history overlay, menus and the block gutter; the shell's `h-full overflow-hidden` and the editor column's scroll and bottom padding are undone in print so the whole document prints, not one screen.
- **Files**: `app/(workspace)/layout.tsx`, `editor.tsx` and the components that own each piece of chrome.
- **Check in a browser first**: auto-grown textareas print in full, images print, a PDF block's embedded viewer — if it prints blank, print its file card instead.
- **Done**: an E2E with `page.emulateMedia({ media: "print" })` shows the content and hides the chrome; a Chrome "PDF로 저장" of a long document by hand.

## Test selection

- Vitest: `lib/documents/export.test.mts` (new), `lib/blocks/markdown.test.mts` (href argument; clipboard output unchanged), `lib/blocks/revision-snapshot.test.mts` (stays green, gains a root sample), the route test (new), `document-export.test.tsx` (new).
- Browser E2E (`e2e/export.e2e.ts`, new; `waitForEvent("download")` as in `e2e/safety.e2e.ts`): text document → `.md` that imports back to the same blocks; document with an image → zip holding the image byte for byte; parent with a child → dialog → zip with the child's `.md`; print media hides the chrome. `--repeat-each=3` on one stack.
- Container smoke: no change expected. The route calls Yorkie's admin RPC from the server, so it is checked on `pnpm docker:up`, not `pnpm dev` (AGENTS §2).
- By hand: open a zip on Windows (Korean names, nested folders); Chrome "PDF로 저장" of a long document with an image and a table.
- Commands and observed results:
  - Spike settled without a capture: `docs/design/file-manager.md` records the `GetDocuments` root as plain JSON (measured on 0.7.23), and the E2E below reads real roots through `readRootBlocks` on 0.7.28 — so the export parses JSON, not YSON.
  - The round trip is a unit test (`markdown.test.mts`: heading, text, ordered list, quote, code, divider → export → `blocksFromMarkdown` gives the same blocks), not an E2E through the 새 문서 dialog; the E2E checks the exported text itself.
  - `pnpm exec vitest run`: 95 files, 995 tests passed (before the last fix; `markdown.test.mts` and `lib/documents` rerun after it: 95 tests passed). `pnpm typecheck`: clean. `eslint` on every touched file: clean. `pnpm verify:docs`: clean. `node scripts/comment-budget.mjs`: only inherited files over budget.
  - E2E on an isolated container stack (`scripts/e2e-isolated.mjs`, `e2e/export.e2e.ts --repeat-each=3`, Chromium): 12 passed. The first attempt failed before any test: an ignored local `.ds-sync/` folder in the checkout broke Docker's build context, so the stack was built from `git archive HEAD` instead.
  - `/simplify` (four reviewers): applied — `planExport` takes the ids and returns `markdown | zip`; attachments are stored (level 0), not deflated, and read in parallel without a copy; the sub-page count is computed on click; the editor's own prompts (`OVERLAY`) were missing `print:hidden`; `readRootBlocks` only swallows a `SyntaxError`. Skipped — making the copy path a link resolver too (no bug, moves ~15 lines), pointing `workspace-files.ts` `placesOf` at `readRootBlocks` (outside this task), exporting the disposition encoder from `serving.ts` (the overrides are commented).
  - `/code-review low`: one finding, fixed — `%` and `#` in a name broke the relative link; they are percent-encoded now, with a test.
  - CodeRabbit, round 1 (8 findings): 7 fixed in 17b8a9b — print sizing of wrapped text and wide tables, 503 on a failed read, only `InvalidFileIdError` read as a missing file, NFC name keys, `[`/`]` escaped in link labels, SRS E6 step 3 wording; declined — printing a PDF block's pages (the design prints its card on purpose).
  - CodeRabbit, round 2: the `field-sizing` print rule skipped Firefox 148 and Safari 26, which the SRS supports, so each text block now prints from a print-only copy of its text (a div wraps at any page width; synced on `beforeprint` in the focused block). The text-block round-trip claim now states its limit: a paragraph that starts with Markdown block syntax reads back as that syntax, since the import decodes no backslash escape. `/code-review low` on the increment: no findings. `/simplify`: the listener only in the focused block, shared text-box classes, overlay tests kept off the print copy, the wide-table print check split into its own E2E.
  - CodeRabbit, round 3 (3 findings, all fixed): the print copy parsed text with no marks, so `\\server\share` printed with one backslash — it now draws inline Markdown only when the text has marks, as the screen does (regression test fails without it); the round-trip limit now covers any block holding a line break (a quote reads back as two quotes, a heading as a heading and a paragraph); the wide-table E2E also bounds the table by the page width.
  - Not done: a zip opened on Windows by hand, and a Chrome "PDF로 저장" of a long document by hand; Firefox and Safari print are covered by reasoning (a div wraps), not by a run. The print E2E checks the swap to the print copy and a wide table's width, not how pages break.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] A text-only document downloads as one `.md`; one with an image or file downloads as a zip holding them.
- [x] A document with sub-pages asks first; "하위 문서 포함" gives a zip that mirrors the hierarchy, with relative links between exported documents.
- [ ] Printing shows only the document content, all of it. (Chrome-hidden in the print E2E; a full printed document not checked by hand.)
- [x] SRS-ko and SRS-en carry FR-022-15..17 and E6; `pnpm verify:docs` clean.

## Cross-cutting

- SRS: FR-022-15, FR-022-16, FR-022-17 and UC-022 E6 (new). Team agreement before merge.
- New dependency: fflate (ADR-003).
- New endpoint in `docs/design/api.md`.
- Limit: the zip is built in memory, fine for a LAN workspace; stated in the design doc.

## Review

Shipped: a ··· menu at the end of the document bar with Markdown and PDF로 인쇄. Markdown is built on the server (`GET /api/documents/:id/export`) from one `GetDocuments` read and the file store: a bare `.md`, or a zip (fflate) with attachments and, after asking, sub-pages in nested folders with relative links. PDF is the browser's print with the workspace chrome hidden through `print:` utilities. SRS FR-022-15..17 and UC-022 E6 added to both languages.

Cut, as agreed when benchmarking Notion: HTML/CSV, "exclude files", the folder toggle, sub-pages in print. Not checked by hand: a zip on Windows and a printed long document.
