# Floating view — Module Design

- **Status**: Agreed 2026-09-24. Built for text-bearing, image and PDF blocks.
- **Owns**: `lib/floating/`, `app/(workspace)/floating-views.tsx`,
  `app/(workspace)/floating-frame.tsx`, `app/(workspace)/use-frame-gesture.ts`.
- **Related**: [`docs/SRS-ko.md`](../SRS-ko.md) UC-070, FR-070-01..06, SIR007;
  [`document-editing.md`](document-editing.md), "Attaching under React's Strict Mode" (the
  shared attachment); [`chat.md`](chat.md), "The floating window" (the geometry it reuses);
  wireframe `docs/ui/app-shell/app-shell.jsx` (`FloatedMirror`).

## Scope

A person pins a block into a window over the workspace and keeps reading it while working
elsewhere. Four decisions bound it:

- **A read-only mirror.** UC-070 asks for reference, and a second editing surface would need
  its own IME handling, undo and occupancy. The window never writes to the document.
- **One entry point**: 🪟 on the right edge of a block row, shown the way the drag handle is.
- **Restored after a reload**, from `localStorage` (`rmf-floating-views`). Which blocks one
  person pinned, and where, is worth nothing to anyone else, the same reasoning as the chat
  window's frame.
- **Text-bearing, image and PDF blocks.** Word/PPT/Excel follow when UC-080's viewer exists;
  chat attachments are out.

## One attachment per document, shared

Yorkie refuses a second `client.attach` of a key the client already has. Floating a block of
the document already open is the common case, so the editor and every window go through
`lib/documents/attach-pool.ts`: a refcount per key, the last release detaches. A second client
was ruled out. It would need its own token path (#50) and double every connection.

A window attaches with `activeBlockId: null`. Occupancy already skips that, so a viewer is
never drawn on anyone's block. Initial presence only counts for whichever holder attaches
first, so the editor sets its own `colorTag` and `nickname` once it has acquired the document.

## What the window shows

The block is re-read on every content change to the shared document, local ones included,
because the editor's own edits reach the mirror through that same document. Presence events
are skipped. A block that is
no longer there turns the window into "원본 블록이 삭제되었습니다." (FR-070-05). The window
stays until closed, because an alert the person never saw vanish is an alert they miss. If the
block comes back (an undo), the window picks it up again.

The provider lives in the workspace layout, which never remounts across document navigation.
That is all FR-070-03 takes.

## Moving and resizing

This is the chat window's behaviour: the same `lib/chat/window-frame.ts` arithmetic, the same
pointer plumbing in `use-frame-gesture.ts`, and the same chrome (title bar, close button, resize
borders) in `floating-frame.tsx`. The gesture captures the pointer,
because a floating PDF's `<iframe>` would otherwise swallow the moves and strand the drag.
Windows sit at `z-[35]`: above the chat bar, below the chat window.

## Not built

- **No document title in the title bar.** `document-editing.md` §11 rules out caching one.
- **No bring-to-front, no cap on open windows, no keyboard move or resize.** The chat window
  has none of these either.
- **A document deleted from the tree still gets its Yorkie key attached.** Its view reads as
  "deleted" because the block is absent, not because the document is gone.
