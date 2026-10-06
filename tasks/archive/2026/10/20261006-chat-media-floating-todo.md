# Chat attachments in floating views, and the chat file list

**Created**: 2026-10-06
**Issue**: #143, #146
**Design**: [`docs/design/floating-view.md`](../../../../docs/design/floating-view.md) (a file as a view's source) and [`docs/design/chat.md`](../../../../docs/design/chat.md) (the file list) — both updated in this task.

#143 lets an image or PDF chat attachment open in a floating view (FR-070-01's "block **or file**"). #146 adds the chat file list (UC-061, FR-061-01..04), whose preview is that floating view — so #143 lands first, in the same PR.

## Milestones

### 1. A floating view whose source is a stored file (#143)

- **What**: `lib/floating/views.ts` gains a second source kind. `BlockRef` stays; a `FileRef` (`{ fileId, fileName, fileType, size }` — the chat attachment's four fields) joins it as `ViewRef = BlockRef | FileRef`. Identity moves from `sameBlock` to one `sameRef` keyed by `documentId:blockId` or `file:fileId`, so open/close/move/fit/parse work unchanged for both. `parseViews` accepts both shapes and still drops malformed or duplicate entries.
- **Rendering**: a file view renders through the existing `MirrorBody` as a synthetic image or PDF block built from the `FileRef` (an attached file and an embedded one are "one thing seen from two places", `chat.md`). No Yorkie attach: a stored file is immutable, so FR-070-04 holds trivially and there is no deletion to watch (FR-070-05 — attachments cannot be deleted, `chat.md` "Open questions"). Title bar shows the file name.
- **Which files float**: exactly the types `GET /api/files/:id/preview` serves inline — `isInlineType` from `lib/files/serving.ts` (PNG/JPEG/GIF/WebP/PDF). Anything else would open a window the server refuses to fill.
- **Entry point**: an "플로팅 뷰로 열기" button on a floatable attachment in `chat-message.tsx`. The chat window is already inside `FloatingViewProvider`, so `useFloatingViews()` reaches it.
- **Files**: `lib/floating/views.ts` (+ test), `app/(workspace)/floating-views.tsx`, `app/(workspace)/chat-message.tsx`.
- **Reuse**: `MirrorBody`, the fit/scale/cascade arithmetic, `FloatingFrame`, `isInlineType`.
- **Done**: an image or PDF attachment opens in a window that survives navigation and reload; opening it twice opens one window; a block view behaves exactly as before.

### 2. The chat file list (#146)

- **What**: a "대화 / 파일" switch at the top of the chat panel. 파일 lists every attachment in the history, newest first, in tabs by kind — 이미지 / PDF / 문서 (UC-061 step 3) — each row showing name, kind, sender and time (FR-061-02), with 미리보기 (opens the #143 floating view, FR-061-03, only for inline types) and 내려받기 (`/api/files/:id/download`, FR-061-04).
- **Derived from messages, not `.data/files/`** — the files store also holds document uploads, and a message already carries sender and time. Pure grouping in `lib/chat/attachments.ts` (+ test); the panel's existing `messages` state is the input, so the list is live without a second fetch.
- **Kind**: `image/*` → 이미지, `application/pdf` → PDF, anything else → 문서. Grouped by an explicit kind so link attachments (FR-060-03, #147) slot in as a fourth tab later.
- **Files**: `lib/chat/attachments.ts` (+ test), `app/(workspace)/chat-files.tsx` (+ component test), `app/(workspace)/chat-panel.tsx`.
- **Reuse**: `ChatAttachment`, `readableSize`, `FileIcon`, the panel's message state, milestone 1's `open`.
- **Done**: an attachment sent in chat appears in the right tab with its sender and time; preview opens the floating view; download downloads.

### 3. Docs

- `docs/design/floating-view.md`: scope line ("chat attachments are out" → in), a short "A file as the source" section, `Status`.
- `docs/design/chat.md`: the file list is built (`Status`, Scope, module structure, Owns gains `app/(workspace)/chat-files.tsx`).

## Acceptance

- [x] `pnpm test` — new cases: `views.test.mts` (open/dedupe/close/parse for a file ref, mixed with block refs), `attachments.test.mts` (kind per type incl. `image/svg+xml` → 이미지 without preview, newest first, text-only messages skipped), `chat-files.test.tsx` (tabs, preview button only for inline types, download href).
- [x] `pnpm lint`, `pnpm build`, `pnpm verify:docs` pass.
- [ ] By hand against the container: send an image and a PDF in chat → each opens in a floating view; reload keeps them; the file list shows both under the right tabs with sender and time; download works. — The image half is automated as `e2e/chat-files.e2e.ts` (passed in CI and locally); the PDF and download halves were not checked by hand.

## Cross-cutting

- SRS: FR-070-01 (file half), FR-061-01..04. FR-061-01's "links" wait for #147.
- Not built: "원본 메시지로 이동" from UC-061's overview line (no FR asks for it); Word/PPT/Excel previews (UC-080).
- No server change: preview/download routes and the chat history API already give everything needed.

## Review

Shipped as #156 (squash c2b7dc6), closing #143 and #146. Beyond the plan:

- `e2e/chat-files.e2e.ts` — send an image, preview it from the file list into a floating view, survive a reload, close.
- Review passes ran as two Sonnet sub-agents in parallel, report-only. Applied: plain buttons for the 대화/파일 switch, `AttachmentKind` derived from `KINDS`, `FloatButton` unexported, comments cut to pointers, and the file-list tabs moved from a partial `role="tab"` pattern to `aria-pressed` buttons in a labelled group. Declined: dropping the kind from each row (FR-061-02 requires it), extracting the download URL and time formatter (one-line duplicates).
- Cut: jumping from a file to its message (no FR); a 링크 tab waits for #147.
