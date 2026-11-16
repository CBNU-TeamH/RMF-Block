# Select whole blocks and copy them as Markdown

**Created**: 2026-11-16
**Issue**: none — requested directly ("드래그해서 블록을 복사하는게 잘 안돼")
**Design**: [document-editing.md, "Selecting and copying blocks"](../../../../docs/design/document-editing.md#selecting-and-copying-blocks)

## Milestones

### 1. Blocks → Markdown

- **What**: write a run of blocks as Markdown, one block per line, so a paste reads it back.
- **Files**: `lib/blocks/markdown.ts`, `lib/blocks/markdown.test.mts`.
- **Reuse**: `orderedListNumbers`, `cellKey`, `documentLinkUrl`.
- **Done**: every block type has an output; the line-per-block types round-trip through `parsePaste`.

### 2. Whole-block selection and copy

- **What**: drag across blocks, Shift+click, and a second Ctrl/Cmd+A select whole blocks; Ctrl/Cmd+C copies them as Markdown; Escape or a click ends it.
- **Files**: `app/(workspace)/documents/[id]/use-block-selection.ts`, `editor.tsx`, `text-block.tsx`, `text-block.test.tsx`, `e2e/selection.e2e.ts`, `docs/design/document-editing.md`.
- **Reuse**: the editor's `readBlocks` on the live document, `elementsRef` for giving the caret back.
- **Done**: the E2E drags, Shift+clicks and presses Ctrl/Cmd+A twice, and reads the copied Markdown.

## Test selection

- Vitest (logic / component / server / route): new `lib/blocks/markdown.test.mts`; `text-block.test.tsx` gains the Ctrl/Cmd+A cases.
- Browser E2E (`e2e/`): new `e2e/selection.e2e.ts` — drag, Shift+click + Escape, Ctrl/Cmd+A twice, each checking the copied text.
- Container smoke (`.github/workflows/ci.yml`): no change — runs the E2E layer.
- Commands and observed results (fill in before the PR): `pnpm test` 85 files / 918 tests passed; lint, typecheck, `verify:docs`, comment budget clean. `pnpm e2e:isolated` (macOS arm64): `selection.e2e.ts` 3/3 passed twice; full suite 39/41 — `tabs.e2e.ts:4` fails here as it does on `main` locally, and `table.e2e.ts:55` (concurrent same-cell input) failed once and passed on rerun.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] A drag from one block into another selects every block between them, and Ctrl/Cmd+C copies their Markdown.
- [x] Shift+click and a second Ctrl/Cmd+A select the same way; Escape and a click end the selection.

## Cross-cutting

FR-022 (block editing). No storage, API or SRS change: selection is local and nothing is published. Cut/delete of a selection was not asked for and is not here. A pasted `- [ ]` reads back as a list item until the paste parser learns GFM checklists (separate task).

## Review

