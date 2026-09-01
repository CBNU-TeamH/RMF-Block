# PDF block and its in-app viewer

**Created**: 2026-09-01
**Issue**: none — this is the first of the file-backed block types the block
editor task deliberately cut (`20260829-block-editor-todo.md` "Cut": *"nothing
can create them until the File API (FR-022-13/14) … exists"*). That File API
now half-exists: `20260831-chat-file-attachments-todo.md` built the store, the
two serving endpoints and the upload guard, and scoped itself out of *"rendering
a PDF page"* as UC-080's job. This task closes both ends.
**Design**: [`docs/design/document-editing.md`](../../docs/design/document-editing.md) §10
(the block's stored shape, already finalized) and
[`docs/design/api.md`](../../docs/design/api.md) §Documents/§Files (the upload
endpoint and the preview/download split).

## Plan

Three decisions worth writing down before any code.

**1. The browser renders the PDF, not a library.** The obvious alternative is
`pdfjs-dist`: canvas rendering, fetched as opaque bytes through `download`, no
new inline content type on the server. It is rejected on `AGENTS.md` §3.2 —
every browser in `docs/SRS-ko.md` §4.2 (Chrome/Edge 145+, Firefox 148+, Safari
26+) ships a PDF viewer with paging, zoom, search and print already, and pdf.js
would add a multi-megabyte dependency plus a worker asset to reimplement them
worse. So: `<iframe src=".../preview">`.

**2. That means `preview` learns a second content type, and the existing
argument covers it.** `lib/files/serving.ts`'s rule is that `preview` may only
name types it can prove are safe. `application/pdf` joins the four image
literals rather than widening to a prefix, for the same reason `image/svg+xml`
is excluded. The stored type is still the uploader's claim, and `nosniff` is
still what stops the browser re-deciding — an HTML file uploaded *as*
`application/pdf` reaches the PDF viewer, fails to parse, and shows an error
instead of a page. Belt and braces: the upload endpoint also checks the bytes
actually start with `%PDF-`, so the claim has to match reality to be stored at
all. That check is not load-bearing for safety; it is what lets the endpoint
refuse a mistake early with a message a person can act on.

**3. Only PDFs, and only by drop or button.** FR-022-14 dispatches five kinds
into three block types; this task implements the PDF leg end to end and refuses
the rest at the endpoint, because a half-supported upload that lands bytes on
disk and then has no block to put them in is worse than a refusal. UC-022's `/`
trigger needs a slash menu that does not exist — the whole block-type menu is
its own task — so the affordances here are the other one the SRS names (drag and
drop) plus a button, which is what the file-picker step of that flow amounts to.

## Milestones

### 1. Documents can receive an upload

- **What**: `POST /api/documents/:id/files` stores a PDF against a real
  document and returns its metadata (FR-022-13). Non-PDF and unknown-document
  are refused before anything is written.
- **Files**: `lib/files/types.ts` (`FileOrigin` gains `"document"`),
  `lib/files/upload.ts` (new — the request guard, lifted out of
  `app/api/chat/files/route.ts` so the two cannot drift), `app/api/chat/files/route.ts`
  (now calls it), `app/api/documents/[id]/files/route.ts` (new).
- **Reuse**: `FileRepository` unchanged — it already stores by id with an
  `origin` field put there for exactly this. `readDocuments()` for the id check.
  The size/content-length guard is moved, not rewritten.
- **Done**: `curl -F file=@x.pdf` against a real document id returns 201 and the
  bytes appear under `.data/files/<id>`; the same with a `.png` returns 415 and
  writes nothing.

### 2. `preview` serves a PDF inline

- **What**: the endpoint that today serves four image types also serves
  `application/pdf`, with the file's name on the response (FR-080-01~03).
- **Files**: `lib/files/serving.ts`, `lib/files/serving.test.mts`,
  `app/api/files/[id]/preview/route.ts`, `docs/design/api.md` (the preview row's
  type list is stated there and would otherwise go stale).
- **Reuse**: `dispositionName()` already percent-encodes and strips CR/LF for
  the download route; the inline response now uses it too.
- **Done**: `GET /api/files/<pdf-id>/preview` answers
  `Content-Type: application/pdf`, `Content-Disposition: inline; filename*=…`,
  `nosniff`; a Word file uploaded through chat still 404s.

### 3. The block renders, and opens full screen

- **What**: a `pdf` block draws a card with an embedded first-page-onward
  viewer, a 전체 화면 button that opens it as an overlay with a close button and
  Esc (FR-080-04), and a download link (FR-080-05's fallback path, offered here
  unconditionally since it costs one link).
- **Files**: `app/(workspace)/documents/[id]/pdf-block.tsx` (new),
  `app/(workspace)/documents/[id]/editor.tsx`.
- **Reuse**: `readBlocks`/`toStoredBlock` already round-trip a `pdf` block —
  `document.ts` was written exhaustive over all twelve types for this moment, so
  storage needs no change at all. `chat-message.tsx`'s attachment card is the
  visual vocabulary; `readableSize` is small enough to restate rather than share
  a module for two call sites.
- **Done**: a `pdf` block seeded into a document by hand renders its pages, and
  the overlay opens and closes.

### 4. Creating and deleting one

- **What**: dropping a PDF on the editor inserts a block at the drop point;
  a button uploads through a file picker; a block can be removed again.
- **Files**: `lib/blocks/create.ts` (`createPdf`), `lib/blocks/create.test.mts`,
  `app/(workspace)/documents/[id]/editor.tsx`, `pdf-block.tsx`.
- **Reuse**: `insertBlockAfter` / `appendBlock` / `removeBlock` as they stand.
  The editor's existing `onDrop` already runs on every block for reorder — an
  external drop is the same event carrying `dataTransfer.files` instead of a
  block id, so it is one branch, not a second drop target.
- **Done**: drag a PDF in → it renders within a second of the upload finishing,
  and a second browser sees the same block appear (the `add` op the subscribe
  handler already recomputes on). Delete asks once (NFR-SAF-002) and the block
  goes on both screens.

## Acceptance

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` pass.
- [ ] Two browsers on one document: a PDF dropped in one appears in the other,
      renders, and deletes from either side.
- [ ] `POST /api/documents/:id/files` refuses: no session (401), unknown
      document (404), no content-length (411), >25 MB (413), non-PDF bytes (415).
- [ ] `GET /api/files/:id/preview` still refuses everything that is not an
      image on the list or a PDF (404), and still sends `nosniff` on both.
- [ ] A block whose file was never uploaded (a `fileId` from another client that
      this store has never seen) renders as a card with an error, not a blank
      frame or a crash.

## Cross-cutting

- **SRS**: FR-022-13, FR-022-14 (the PDF leg only), FR-080-01, -02, -03, -04,
  -05, NFR-SAF-002 (delete reconfirms).
- **`docs/design/api.md`**: the Status line lists shipped endpoints, and the
  preview row states which types it serves. Both change.
- **Not touched**: `docs/SRS-ko.md` (`AGENTS.md` §5 — team agreement first),
  `docs/design/document-editing.md` §10 (the stored shape is already what this
  writes).
- **Left open, on purpose**:
  - Image and generic-file blocks — the other two legs of FR-022-14.
  - The `/` block-type menu (UC-022 step 1).
  - Deleting a block does not delete its bytes. FR-050-06 ("exclude files whose
    block was deleted") is a *query* over the store, and the store is shared
    with chat, so orphan collection belongs to UC-050's file manager, not here.
  - `GET /api/files` (UC-050) and the floating view (UC-070).

## Review

**Shipped**, all four milestones.

| | |
| --- | --- |
| `lib/files/upload.ts` (new) | the shared request guard (`readUpload`) plus `looksLikePdf`; `app/api/chat/files/route.ts` now calls it instead of holding its own copy |
| `app/api/documents/[id]/files/route.ts` (new) | PDF upload against a real document, `origin: "document"` |
| `lib/files/serving.ts` | `isInlineType` / `inlineHeaders` — the inline list gains `application/pdf`, and both inline and attachment responses now carry the file's name |
| `lib/blocks/create.ts` | `createPdf` |
| `app/(workspace)/documents/[id]/pdf-block.tsx` (new) | the block: card, inline `<iframe>` viewer, 전체 화면 overlay, download, delete-with-confirm, missing-file state |
| `app/(workspace)/documents/[id]/editor.tsx` | drop-to-upload, the PDF 추가 picker, `handleDeleteBlock`, and the `pdf` case in the renderer |
| `docs/design/api.md` | the two endpoints' rows, the shipped list, and the preview type table |

Storage needed **no** change: `readBlocks`/`toStoredBlock` already round-tripped a
`pdf` block, exhaustive over all twelve types since the block-editor task.

### Verified

Run against a real stack (Yorkie 0.7.13 + Mongo in Docker, `pnpm dev`), not only
in tests.

- `pnpm lint`, `pnpm test` (301 pass), `npx tsc --noEmit`, `pnpm build` — all clean.
- `POST /api/documents/:id/files`: 201 for a real PDF; **415** for `PK` bytes sent
  as `application/pdf` (nothing written); 404 unknown document; 401 no session;
  413 over the 25 MB declaration.
- `GET .../preview` for that file: `application/pdf`, `inline;
  filename*=UTF-8''capstone-report.pdf`, `nosniff`, `private`; bytes byte-identical
  to the upload (`cmp`). `GET .../download`: `application/octet-stream`,
  `attachment`. A `text/html` chat upload still 404s from `preview`.
- In the editor: the block renders page 1 inline; 전체 화면 opens the overlay with
  the browser viewer at `1 / 2` pages; 닫기 and `Escape` both close it; drop and
  the picker both create a block at the right position; delete asks once and then
  removes it; both blocks survive a reload (so they are in Yorkie, not React
  state); with the bytes removed the block shows 파일을 찾을 수 없습니다 and keeps
  its download link; a non-PDF drop shows the endpoint's refusal and creates
  nothing.
- **Realtime, with a genuine second client** — a Yorkie client attached from Node
  with a token from `/api/auth/yorkie-token` (two browser tabs cannot do this: one
  session per member). It received `add@$.blocks` when the browser created a
  block and `remove@$.blocks` when the browser deleted one, reading
  `pdf:<fileName>` each time; and a block *it* pushed appeared in the browser
  rendered, with no reload.

### Changed by the review pass

- The full-screen viewer was a hand-rolled `<div>` overlay; it is now a real
  `<dialog>` opened with `showModal()`, matching `join-form.tsx` and its written
  reasoning. That deleted the manual backdrop, the Esc listener and the
  `autoFocus`, and it surfaced a bug worth having found: **an `<iframe>` inside a
  closed `<dialog>` still loads its `src`**, so every PDF block on the page was
  fetching its file twice. The frame is now mounted only while open — measured
  before and after, 1 iframe closed / 2 open.
- `uploading` became a count of uploads in flight. With a boolean, a second drop
  while the first was still going had the first one to finish clear the
  indicator.
- `README.md` gained a third "trap": `pnpm dev` serves `/_next/*` to `localhost`
  only, so another device gets HTML with no JavaScript and a login that silently
  never runs. Cost an hour during verification; the fix is `pnpm start`.
- `docs/design/api.md`'s Files table gained the Status column the other two
  tables already had, and `document-editing.md` §10 now records *why* the PDF
  block needs no page-state fields.

### Cut, as planned

The image and generic-file legs of FR-022-14 (the endpoint refuses them), the `/`
block-type menu, orphan-file collection when a block is deleted (FR-050-06's
query, UC-050's job), `GET /api/files`, and the floating view.
