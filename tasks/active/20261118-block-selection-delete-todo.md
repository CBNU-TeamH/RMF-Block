# Delete and cut a whole-block selection

**Created**: 2026-11-18
**Issue**: none — requested directly ("여러 블록을 드래그해서 삭제하는 기능은 안되네?", then "잘라내기도 같이 넣어주고")
**Design**: [document-editing.md, "Selecting and copying blocks"](../../docs/design/document-editing.md#selecting-and-copying-blocks)

## Milestones

### 1. Backspace/Delete on a selection

- **What**: with blocks selected (drag, Shift+click, Ctrl/Cmd+A twice), Backspace or Delete removes them all in one edit and puts the caret in the block after them.
- **Files**: `lib/blocks/operations.ts` (+ test), `app/(workspace)/documents/[id]/use-block-selection.ts`, `editor.tsx`, `e2e/selection.e2e.ts`, `e2e/helpers.ts`, `docs/design/document-editing.md`.
- **Reuse**: the selection hook's hidden textarea for the key, `applyEdit`, `focusBlock`; the trailing-empty-block check moves out of `ensureTrailingEmptyBlock` into `operations.ts` (`trailingTextId`/`keepTrailingText`) so the delete can run it inside its own update. A block's delete button uses it too.
- **Done**: the E2E deletes a dragged run and every block, and one Ctrl/Cmd+Z brings each back.

### 2. Ctrl/Cmd+X on a selection

- **What**: cut — the copy Ctrl/Cmd+C already does, then the delete above, only if the copy succeeded.
- **Files**: `use-block-selection.ts`, `e2e/selection.e2e.ts`, `docs/design/document-editing.md`.
- **Reuse**: the proxy's `onCopy` (through `document.execCommand("copy")`, as `copyText` in `ui.tsx` already does) and `deleteBlocks`.
- **Done**: the E2E cuts a dragged run and reads the copied Markdown; the blocks are gone.

## Test selection

- Vitest (logic / component / server / route): `operations.test.mts` gains `removeBlocks` (several ids; a missing id skipped) and `keepTrailingText` (kept, appended, refilled after emptying the array in the same update — fails without the `[-1]` guard — and one undo restores). The keys live on the hidden textarea, which only a browser exercises.
- Browser E2E (`e2e/`): `e2e/selection.e2e.ts` gains three cases — Backspace on a dragged run, then undo; Delete on every block, then undo; Ctrl/Cmd+X on a dragged run, reading the copied Markdown.
- Container smoke (`.github/workflows/ci.yml`): no change — runs the E2E layer.
- Commands and observed results (fill in before the PR): `pnpm test` 87 files / 953 tests passed; lint, typecheck, `verify:docs`, comment budget clean. `pnpm e2e:isolated e2e/selection.e2e.ts --repeat-each=2` (macOS arm64): 10/10, and 12/12 with the cut case. Full `pnpm e2e:isolated` after the `/simplify` changes: 45 passed, 1 failed — `tabs.e2e.ts:4` (tab name after a rename), which fails here as it does on `main` locally and passes in CI.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] Backspace or Delete on a selection removes every selected block; the caret lands in the block after them.
- [x] One Ctrl/Cmd+Z restores the whole run, including after every block was deleted.
- [x] Ctrl/Cmd+X copies the selection as Markdown, then deletes it.

## Cross-cutting

FR-022-03 (delete blocks). No storage, API or SRS change.

## Review

Shipped as planned; cut was added on request after the PR opened. `/simplify` moved the removal and the trailing-block rule into `operations.ts` (one pass, unit-tested) and put a block's own delete button on the same one-update path.
