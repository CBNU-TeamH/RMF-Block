# Floating view — Module Design

- **Status**: Agreed 2026-09-24. Built for text-bearing, image and PDF blocks, and for image
  and PDF chat attachments (#143).
- **Owns**: `lib/floating/`, `app/(workspace)/floating-views.tsx`,
  `app/(workspace)/floating-frame.tsx`, `app/(workspace)/use-frame-gesture.ts`.
- **Related**: [`docs/SRS-ko.md`](../SRS-ko.md) UC-070, FR-070-01..06, SIR007;
  [`document-editing.md`](document-editing.md), "Attaching under React's Strict Mode" (the
  shared attachment); [`chat.md`](chat.md), "The floating window" (the geometry it reuses);
  wireframe `docs/ui/app-shell/app-shell.jsx` (`FloatedMirror`).

## Scope

A person pins a block, or a file shared in chat, into a window over the workspace and keeps
reading it while working elsewhere. Four decisions bound it:

- **A read-only mirror.** UC-070 asks for reference, and a second editing surface would need
  its own IME handling, undo and occupancy. The window never writes to the document.
- **One entry point per source**: for a block, a 24px window-glyph button left of a block row's
  drag handle, shown the way the handle is. It sits next to the handle, not on the right edge,
  so it is easy to hit. For a chat attachment, "플로팅 뷰로 열기" under the message, and
  "미리보기" in the chat file list (`chat.md`).
- **Restored after a reload**, from `localStorage` (`rmf-floating-views`). Which blocks one
  person pinned, and where, is worth nothing to anyone else, the same reasoning as the chat
  window's frame.
- **Text-bearing, image and PDF blocks, and image and PDF chat attachments.** Word/PPT/Excel
  follow when UC-080's viewer exists.

## One attachment per document, shared

The editor and every window share one `client.attach` per document through
`lib/documents/attach-pool.ts` (why, and how, in
[document-editing.md](document-editing.md#attaching-under-reacts-strict-mode)). A second client
was ruled out. It would need its own token path (#50) and double every connection.

A window attaches with `activeBlockId: null`. Occupancy already skips that, so a viewer is
never drawn on anyone's block. Sharing imposes three rules on the editor:

- **Identity is set after `acquire`.** Initial presence only counts for whichever holder
  attaches first, and an effect re-run after the roster lands never re-attaches.
- **`activeBlockId`, `marks` and `pointer` are cleared when the editor releases the document**
  (`use-block-document.ts`), because a release no longer detaches. With a floating view still
  holding it, peers would otherwise see this browser on its last block until the 30 s occupancy
  TTL, and followers would see a presenter's old ink on returning to a document the presenter's
  own screen had already cleared.
- **`docRef` is cleared in the cleanup itself, not once setup settles.** Every run gets the same
  document, so a late `docRef.current === held` check would clear the *next* run's ref, and under
  Strict Mode that drops every edit.

## What the window shows

The block is re-read on every content change to the shared document, local ones included,
because the editor's own edits reach the mirror through that same document. Presence events
are skipped. A block that is
no longer there turns the window into "원본 블록이 삭제되었습니다." (FR-070-05). The window
stays until closed, because an alert the person never saw vanish is an alert they miss. If the
block comes back (an undo), the window picks it up again.

The title bar shows the source document's name. `document-editing.md` §11 rules out *caching*
a title, and nothing is cached here: the provider reads the catalogue once
(`GET /api/documents`) and follows the workspace socket's `document:created`, `document:changed`
and `document:deleted` events, the ones `document-list.tsx` already listens to. A rename reaches
every window live. A deleted **document** disables its windows with
"원본 문서가 삭제되었습니다.", the same treatment a deleted block gets.

The provider lives in the workspace layout, which never remounts across document navigation.
That is all FR-070-03 takes.

## A file as the source

A chat attachment opens as a view of the stored file, not of a block. `lib/floating/views.ts`
keys every view by its source — `block:<documentId>:<blockId>` or `file:<fileId>`, both
prefixed so neither can read as the other — and open, close, move, fit and the saved list work
the same for both.

- **It saves the attachment's four fields** (`fileId`, `fileName`, `fileType`, `size`), so a
  window restored after a reload needs no lookup. They cannot go stale: the SRS gives files no
  rename.
- **It draws through the block path.** The window builds an image or PDF block from those fields
  and hands it to the same renderer, so fitting and scaling are the block rules below. An
  attached file and an embedded one are one thing seen from two places (`chat.md`).
- **Nothing is mirrored.** A stored file never changes, so FR-070-04 holds without a
  subscription, and there is no Yorkie attach. FR-070-05 has nothing to watch: attachments
  cannot be deleted (`chat.md`, "Open questions").
- **Only the types the preview route serves inline float** — `isInlineType` in
  `lib/files/serving.ts`. Any other type would open a window the server refuses to fill.
- **The title bar shows the file's name**, where a block's window shows its document's.

## Fitted, then scaled

A new window fits its content, then resizes like picture-in-picture: from its corner, with its
ratio locked, and the content scales with it.

- **The fit.** The first time a block renders, it is measured at scale 1 before paint, so the
  unfitted window never shows. That size is stored as the view's `base` and saved with it.
  - Text is measured at most 360px wide.
  - An image uses its natural size, capped at 360×360.
  - A PDF, which has no size of its own, gets 360×480.
  - All of them include a 12px margin.
  - The window is never fitted narrower than 160px, or the document's name has no room beside
    the ✕.
- **The scale.** The content keeps the shape it was measured at, and the window's width over
  `base.width` is its CSS `zoom`. `zoom`, not `transform`, because it scales layout: text stays
  crisp and a scrollbar still means something. It is supported by every SRS §4.2 browser.
- **The corner.** The scale follows whichever axis the pointer moved further along, in
  proportion. A window never grows just because its grip was touched, and the viewport beats the
  120px floor, since a grip past the edge cannot be grabbed again. The arithmetic is in
  `lib/floating/views.ts`, next to its tests.
- **Content that grows later** (someone keeps typing) scrolls inside the window. It does not
  resize the window under the reader, because `base` is fixed at the first fit.

## Moving and resizing

The pointer plumbing in `use-frame-gesture.ts` and the chrome in `floating-frame.tsx` (title
bar, close button, resize handles) are shared with the chat window. The geometry is each
window's own: the hook takes it as `rules`. The chat window keeps `lib/chat/window-frame.ts`
and `FloatingFrame` renders either its three resize borders (`resize="edges"`, the chat window)
or one corner grip (`resize="corner"`, the ratio-locked corner above). A floating view's ✕ turns
red on hover; the chat window's turns dark. While a gesture runs,
every `<iframe>` on the page has `pointer-events: none`, because a PDF under the pointer would
otherwise take the moves for itself and stall the drag, and pointer capture does not hold across
Chrome's PDF viewer (measured with Playwright).
Windows sit at `z-[35]`: above the chat bar, below the chat window.

The saved list is re-fitted to the current viewport on load and on every viewport resize
(`fitFloating`), so a window saved on a larger screen is never left off-screen. There is one
window per block or file: opening one that already has a window does nothing, and a saved entry that is
malformed or a duplicate is dropped on load (`parseViews`).

## Not built

- **No bring-to-front, no cap on open windows, no keyboard move or resize.** The chat window
  has none of these either.
- **No smarter cascade.** New windows step 24px down-left from the top right. Small fitted
  windows overlap one another's content; each title bar stays visible.
