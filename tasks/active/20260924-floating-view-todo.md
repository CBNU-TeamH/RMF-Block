# Floating view of a block (UC-070)

**Created**: 2026-09-24
**Issue**: none — ROADMAP Phase 4, `docs/SRS-ko.md` UC-070 / FR-070-01..06 / SIR007
**Design**: wireframe `docs/ui/app-shell/app-shell.jsx` (`FloatingBlock`, `FloatedMirror`);
the shared-attachment rule lands in `docs/design/document-editing.md`, "Attaching under React's
Strict Mode".

Pin a block into a window that floats over the workspace, survives navigation and reloads,
mirrors the source live, and says so when the source is gone. Agreed scope (2026-09-24):

- **Read-only mirror.** Reference, not a second editing surface.
- **Entry point**: one 🪟 button on block hover. No context menu, no shortcut.
- **Restored after reload** from `localStorage` — one viewer's convenience, like the chat window's frame.
- **Files**: image and PDF blocks only. Word/PPT/Excel follow UC-080's viewer; chat attachments are out.

The constraint that shapes the build: Yorkie refuses a second `client.attach` of the same key
(`"<key> is already attached"`), and floating a block of the document already open is the common
case. A second client is out (#50's token hole, doubled connections), so the editor and every
floating window share **one attachment per document key**.

## Milestones

### 1. One shared attachment per document key

- **What**: a refcounted pool — `acquire` on a live key returns the same document, the last
  `release` detaches, an `acquire` during a detach waits for it, a failed attach can be retried.
- **Files**: `lib/documents/attach-pool.ts` (+ `.test.mts`),
  `app/(workspace)/documents/[id]/use-block-document.ts`, `docs/design/document-editing.md`.
- **Reuse**: replaces `use-block-document.ts`'s `teardownRef` chain — same rule, now per key
  instead of per hook. `presence-provider.tsx` keeps its own chain; the workspace doc is not pooled.
- **Done**: pool tests pass; the editor still opens, edits, undoes and restores revisions; a
  Strict Mode double-invoke no longer re-attaches (count 1→2→1).

### 2. Reuse the chat window's drag and resize

- **What**: move the gesture handling out of `ChatWindow` into a hook both windows use.
- **Files**: `app/(workspace)/use-frame-gesture.ts`, `app/(workspace)/chat-window.tsx`.
- **Reuse**: `lib/chat/window-frame.ts` as-is (`clamp`, `applyGesture`, `parseFrame`, `BAR_HEIGHT`).
- **Done**: chat window moves, resizes and remembers its frame exactly as before.

### 3. Floating view state and window

- **What**: a provider in the workspace layout holding the open views, a window per view that
  mirrors its block and shows "원본 블록이 삭제되었습니다." once the block is gone.
- **Files**: `lib/floating/views.ts` (+ `.test.mts`), `app/(workspace)/floating-views.tsx`,
  `app/(workspace)/layout.tsx`.
- **Reuse**: `readBlocks` (`lib/blocks/document.ts`), `/api/files/:id/preview` as the image/PDF
  blocks use it, presence with `activeBlockId: null` which occupancy already ignores.
- **Done**: views parse/open/close/move tested; a window survives navigation and reload.

### 4. The hover button

- **What**: 🪟 on the right edge of every text, image and PDF block row.
- **Files**: `app/(workspace)/documents/[id]/editor.tsx`.
- **Reuse**: `isTextBearing` (`lib/blocks/registry.ts`), the drag handle's hover classes.
- **Done**: clicking it opens (or leaves open) that block's window.

## Acceptance

- [ ] `pnpm verify:fast`, `pnpm build`, `pnpm comments`, `pnpm verify:docs` pass.
- [ ] FR-070-01: a text, image or PDF block opens in a floating window.
- [ ] FR-070-02/03: the window stays over the shell across document navigation (and reload).
- [ ] FR-070-04: a peer's edit to the block appears in the window live.
- [ ] FR-070-05: deleting the block disables the window with the deletion notice.
- [ ] FR-070-06: two or more windows open at once.
- [ ] Opening a document under `pnpm dev` (Strict Mode) logs no attach errors.

## Cross-cutting

- FR-070-01..06, SIR007. Word/PPT/Excel (UC-070 비고) wait on UC-080.
- Every content-document attach now goes through the pool — `version-history.tsx` and
  `ink-overlay.tsx` read the same `docRef` and need no change.

## Review

Filled in at the end.
