# Pasting into blocks, and the image and file legs of FR-022-14

**Created**: 2026-09-07
**Issue**: none — FR-022-13/14 are unbuilt requirements, paste is a UX gap found while surveying the editor.
**Design**: [`docs/design/document-editing.md`](../../docs/design/document-editing.md) "Block types" §8–9 (file, image) and "Editing surface"; [`api.md`](../../docs/design/api.md) §1 for the upload contract.

Two thirds of FR-022-14 are missing, and pasting more than one line puts it all in one block.

## Milestones

### 1. Pasting several lines makes several blocks

- **What**: pasting multi-line text splits at newlines and creates one block per line, with a
  markdown marker at the start of a line converting that line's block.
- **Files**: `lib/blocks/paste.ts` (new, pure), `lib/blocks/paste.test.mts` (new),
  `app/(workspace)/documents/[id]/text-block.tsx` (an `onPaste`),
  `app/(workspace)/documents/[id]/editor.tsx` (the handler).
- **Reuse**: `insertBlockAfter` and `toStoredBlock` already do the writing; `create.ts` already has
  a factory per type. What does not exist is a parser — `detectMarkdownShortcut` matches a marker
  as the block's **entire** text (`"# "` triggers, `"# hello"` does not), which is right for typing
  and useless for a paste, where the marker always arrives with its line.
- **Done**: pasting three lines into an empty block leaves three blocks; pasting `# A`⏎`- B` leaves
  a heading and a bullet.

**A single-line paste stays a text insert.** It goes through the textarea's own default, which
already lands in the right place in the middle of a word. Only a newline makes this a block
operation, and that keeps the common paste on the path that already works.

**The first line reuses the block being pasted into**, rather than inserting above it. That block
already has focus and a caret; making a new one and deleting the old would move both.

### 2. An image block (FR-022-14, image leg)

- **What**: an uploaded image renders inline in the document.
- **Files**: `lib/files/upload.ts` (byte sniffing), `app/api/documents/[id]/files/route.ts`,
  `lib/blocks/create.ts`, `app/(workspace)/documents/[id]/image-block.tsx` (new),
  `app/(workspace)/documents/[id]/editor.tsx`, `lib/blocks/slash-menu.ts`.
- **Reuse**: the whole path exists for PDF — `readUpload`'s size and content-length guards,
  `fileRepository`, `/api/files/:id/preview`, and `serving.ts`, whose `INLINE_TYPES` **already**
  lists `image/png`, `image/jpeg`, `image/gif` and `image/webp`. `useFileUpload`'s anchor-and-insert
  logic generalises. What is new: sniffing which image a file is, and the renderer.
- **Done**: dropping a PNG into a document shows the image; a renamed `.txt` is refused.

**The stored type comes from the bytes, never from the request.** `serving.ts` answers `inline`
for anything whose *stored* type is in `INLINE_TYPES`, so trusting the uploader's MIME would let an
HTML file be stored as `image/png` and then served inline — the exact hole `api.md` §1 names.
`looksLikePdf` already works this way; images need the same, one magic number per format.

**SVG is not an image here.** It is in no browser's "safe inline" set for good reason: it can carry
`<script>`, and `INLINE_TYPES` already excludes it deliberately. An `.svg` therefore becomes a
**file** block (milestone 3), which is only ever served as an attachment.

### 3. A generic file block (FR-022-13)

- **What**: any other upload becomes a file block — a card with the name, size and a download link.
- **Files**: `app/(workspace)/documents/[id]/file-block.tsx` (new), plus the same four touched above.
- **Reuse**: `attachmentHeaders` is already unconditional `application/octet-stream` +
  `attachment`, so nothing a file block points at can render or execute in the browser. That is
  what makes "accept any type" safe here.
- **Done**: dropping a `.zip` or a `.docx` shows a card that downloads under its original name.

FR-022-14 names Word/PPT/Excel specifically. They are file blocks: this project has no viewer for
them, and a download card is the honest rendering. Recorded rather than silently scoped out.

## Acceptance

- [ ] `pnpm test` — `paste.ts` covers: one line is not a split; trailing newline does not make an
      empty block; `\r\n` and `\n` both split; a marker converts its own line only; a line that is
      only a marker stays an empty block of that type.
- [ ] `pnpm test` — image sniffing covers each accepted format's magic number, plus a refusal for
      a file whose extension and MIME lie about it.
- [ ] `npx tsc --noEmit`, `pnpm lint`, `pnpm build`, `pnpm verify:docs` clean.
- [ ] Browser: paste three lines, drop a PNG, drop a non-image non-PDF, and reload — all four
      survive, and a second client sees them.
- [ ] An HTML file renamed to `.png` and uploaded is refused, not stored as an image.

## Cross-cutting

- **SRS**: FR-022-13 and the image leg of FR-022-14. No SRS change; Word/PPT/Excel are file blocks.
- **Docs**: `document-editing.md` §"Block types" describes `file` and `image` as designed-not-built,
  and the editor's own `UnsupportedBlock` claim goes stale. `api.md` §1 says the document upload
  endpoint is PDF-only — that sentence changes here.
- **`upload.ts`'s `looksLikePdf`** becomes one of several sniffers; the module's framing changes.

## Review

**Shipped**: all three milestones.

| | |
| --- | --- |
| `lib/blocks/paste.ts` | the line parser, 20 tests |
| `lib/files/upload.ts` | `detectImageType` — PNG/JPEG/GIF/WebP by magic number, 7 tests |
| `app/api/documents/[id]/files/route.ts` | accepts any file; the stored type comes from the bytes |
| `image-block.tsx`, `file-block.tsx` | the two renderers |
| `use-pdf-upload.ts` → `use-file-upload.ts` | renamed; it no longer only handles PDFs |
| `lib/files/size.ts` | `readableSize`, extracted at its own stated threshold |

Suite **396 → 419**.

**Verified without a browser**, by `curl` against the running app:

| upload | stored type | `GET /preview` |
| --- | --- | --- |
| a real PNG | `image/png` | **200**, `inline` + `nosniff` |
| **HTML renamed `.png`** | **`application/octet-stream`** | **404** |
| `.txt` | `application/octet-stream` | (file block, download only) |

Both layers hold independently: the sniffing refuses to *store* it as an image, and `serving.ts`
refuses to *serve* a non-`INLINE_TYPES` file inline even if it had.

**Not verified**: the paste handler writing to the document, and the two renderers drawing. The
browser extension disconnected partway through the check. The parsing and the sniffing are covered
by unit tests, and the upload path by the table above, but "the handler writes what the parser
returned" is not something those reach. An image block and two file blocks have been seeded into
the test document so this is one page-load away from being confirmed.

**Cut**: nothing.

**Changed from the plan**: the `/` menu gained one **파일** item rather than three. Which block an
upload becomes is decided from its bytes, so asking the person to pick first would be asking them
to guess at an answer the server already has.
