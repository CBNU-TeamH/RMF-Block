# Undo a version restore in one Ctrl+Z

**Created**: 2026-11-24
**Issue**: #185
**Design**: [version-history.md](../../docs/design/version-history.md) ("Why the app restores instead of calling `restoreRevision`"); [document-editing.md](../../docs/design/document-editing.md) ("Undo is per person").

## Milestones

### 1. Restore as one `doc.update`

- **What**: restoring a revision is one step on Yorkie's undo stack, so one Ctrl+Z returns the document to its pre-restore state. Today `replaceBlocks` makes two `doc.update()` calls (set `root.blocks` with empty `yorkie.Text`, then fill text and table cells), and the first undo only clears the text.
- **Files**: `app/(workspace)/documents/[id]/use-block-document.ts` (`replaceBlocks`); `docs/design/version-history.md`; `docs/design/document-editing.md` only if it says a restore is two steps. If the hook cannot be unit-tested, the update body moves into a small function in `lib/blocks/`.
- **Reuse**: `toStoredBlock`, `fillTable`, `editBlockText` as they are used now. The test `lib/blocks/operations.test.mts` ("refills a document emptied in the same update, which one undo takes back") already shows a clear-and-refill in one update undoing as one step.
- **Spike first**: the comment on `replaceBlocks` says a `yorkie.Text` cannot be edited before it is in the tree. That may only hold for the object not yet assigned; after `root.blocks = …`, re-reading `root.blocks` inside the same callback gives the in-tree nodes. A failing or passing test settles it before any code changes.
- **If the spike fails**: stop and ask — the fallback is merging the two undo-stack entries, which touches `getUndoStackForTest()` and `undoFloorRef`, and that is a design call, not a fix.
- **Done**: a test restores a document holding a text block and a table block, then one `doc.history.undo()` returns the earlier blocks and their text.

## Test selection

- Vitest (logic / component / server / route): a local-document test in the style of `operations.test.mts` (`newDoc`, seed, `history.undo()`), covering a text block and a table block. Existing `table.test.mts` and `operations.test.mts` stay as the neighbours that must keep passing.
- Browser E2E (`e2e/`): no new spec. Whether an existing spec restores a version and undoes is checked with a search of `e2e/` before the PR; if one does, it is read, not rewritten.
- Container smoke (`.github/workflows/ci.yml`): no change — nothing touches startup, auth or networking.
- A restore through the container and browser is the one check the unit test cannot make (the issue says it was never reproduced there). Ask before starting the Docker stack for it; if skipped, the PR says so.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] One Ctrl+Z after a restore returns the document to its pre-restore state.
- [ ] The regression test fails on the two-update code and passes on the fix.
- [ ] A remote peer still sees the restored blocks and text, and `replaceBlocks` still re-reads the blocks and bumps `restoreCount` — a local change never comes back through `doc.subscribe`.

## Cross-cutting

UC-022 editing and the version-history requirements; no SRS, storage or API change. The undo floor (`undoFloorRef`) must still stop an undo reaching past the document's own seed.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
