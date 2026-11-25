# Undo a version restore in one Ctrl+Z

**Created**: 2026-11-24
**Issue**: #185
**Design**: [version-history.md](../../../../docs/design/version-history.md) ("Why the app restores instead of calling `restoreRevision`"); [document-editing.md](../../../../docs/design/document-editing.md) ("Undo is per person").

## Milestones

### 1. Restore as one `doc.update`

- **What**: restoring a revision is one step on Yorkie's undo stack, so one Ctrl+Z returns the document to its pre-restore state. Today `replaceBlocks` makes two `doc.update()` calls (set `root.blocks` with empty `yorkie.Text`, then fill text and table cells), and the first undo only clears the text.
- **Files**: `lib/blocks/restore.ts` (new, `replaceAllBlocks`) + `restore.test.mts`; `app/(workspace)/documents/[id]/use-block-document.ts` (`replaceBlocks` calls it in one `doc.update`); `docs/design/version-history.md` (owns the new file); `docs/design/document-editing.md` (its table section named the two-update path). Not in `operations.ts`: it would import `table.ts`, which already imports `operations.ts`.
- **Reuse**: `toStoredBlock`, `fillTable`, `editBlockText` as they are used now. The test `lib/blocks/operations.test.mts` ("refills a document emptied in the same update, which one undo takes back") already shows a clear-and-refill in one update undoing as one step.
- **Spike first**: the comment on `replaceBlocks` says a `yorkie.Text` cannot be edited before it is in the tree. That may only hold for the object not yet assigned; after `root.blocks = …`, re-reading `root.blocks` inside the same callback gives the in-tree nodes. A failing or passing test settles it before any code changes.
- **If the spike fails**: stop and ask — the fallback is merging the two undo-stack entries, which touches `getUndoStackForTest()` and `undoFloorRef`, and that is a design call, not a fix.
- **Done**: a test restores a document holding a text block and a table block, then one `doc.history.undo()` returns the earlier blocks and their text.

## Test selection

- Vitest (logic / component / server / route): a local-document test in the style of `operations.test.mts` (`newDoc`, seed, `history.undo()`), covering a text block and a table block. Existing `table.test.mts` and `operations.test.mts` stay as the neighbours that must keep passing.
- Browser E2E (`e2e/`): no new spec. Whether an existing spec restores a version and undoes is checked with a search of `e2e/` before the PR; if one does, it is read, not rewritten.
- Container smoke (`.github/workflows/ci.yml`): no change — nothing touches startup, auth or networking.
- A restore through the container and browser is the one check the unit test cannot make (the issue says it was never reproduced there). Ask before starting the Docker stack for it; if skipped, the PR says so.
- Commands and observed results:
  - Spike (a throwaway test, deleted): with the current two updates, one `undo()` left the document different from before the restore; with both steps in one update, one `undo()` returned it exactly and `redo()` returned the restored blocks. So a `yorkie.Text` re-read from `root.blocks` inside the same update can be edited — the old comment held only for the object before it is assigned.
  - `lib/blocks/restore.test.mts`: a heading, a 2×2 table with two filled cells and a text block replace one text block; one `undo()` gives back the original, `redo()` the restored blocks and cells. The test calls `replaceAllBlocks` inside one update, so it cannot run against the old two-update hook; the spike above is that comparison.
  - `pnpm exec vitest run` on `restore`, `table`, `operations`, `revision-snapshot` and `version-history`: 5 files, 57 tests passed. `tsc --noEmit`: clean. `eslint` on the three touched files: clean. `pnpm verify:docs`: clean.
  - `/simplify`: no change. It noted that the seed path in `use-block-document.ts` could use `replaceAllBlocks` too; skipped as outside #185 (below the undo floor, and it would touch the documented seeding race). `/code-review low`: no findings, from reading `01e3448` only.
  - No container or browser restore was run (the check this task said to ask about first); the E2E `history.e2e.ts` restore spec runs in CI.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] One Ctrl+Z after a restore returns the document to its pre-restore state.
- [x] The regression test fails on the two-update code and passes on the fix — shown by the spike's side-by-side, since the new test drives the one-update function directly.
- [x] `replaceBlocks` still re-reads the blocks and bumps `restoreCount` (unchanged lines). A remote peer seeing the restore is left to `history.e2e.ts` in CI.

## Cross-cutting

UC-022 editing and the version-history requirements; no SRS, storage or API change. The undo floor (`undoFloorRef`) must still stop an undo reaching past the document's own seed.

## Review

Shipped: `replaceAllBlocks` writes the restored array and fills its text and table cells in one update; `replaceBlocks` calls it, so a restore is one undo step. The spike settled it, so the undo-stack fallback this task held in reserve was not needed.

Not done: one Ctrl+Z after a restore was not checked in a browser (unit test only). The seed path in `use-block-document.ts` still uses two updates; it sits below the undo floor, so it does not show to the user, and it was left alone.
