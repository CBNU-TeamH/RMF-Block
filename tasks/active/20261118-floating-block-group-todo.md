# Several selected blocks in one floating view

**Created**: 2026-11-18
**Issue**: none — requested directly ("여러개 한번에 묶어서 하나의 탭으로 띄워두고 싶어"); the maintainer chose the selected blocks as the way in and one document as the scope.
**Design**: [floating-view.md, "Several blocks in one window"](../../docs/design/floating-view.md#several-blocks-in-one-window)

## Milestones

### 1. A run of blocks as a view's source

- **What**: a view can name several blocks of one document (`blockIds`), keyed, saved and restored like a block or a file.
- **Files**: `lib/floating/views.ts`, `lib/floating/views.test.mts`.
- **Reuse**: `refKey`, `parseViews`, `openView`'s duplicate and cap checks — unchanged, they work on the key.
- **Done**: unit tests open, dedupe and read back a run, and drop a malformed one.

### 2. One window, several blocks

- **What**: the window mirrors every block of its run in order, marks a deleted one in place, and fits by the group rule; a selected row's float button opens the selection.
- **Files**: `app/(workspace)/floating-views.tsx`, `documents/[id]/editor.tsx`, `use-block-selection.ts`, `e2e/floating-windows.e2e.ts`, `docs/design/floating-view.md`, `docs/design/document-editing.md`.
- **Reuse**: the shared attachment (`acquireBlockDocument`), `MirrorBody`, `canFloat`, the block selection from #272.
- **Done**: the E2E selects two blocks, floats them as one window and sees one of them marked deleted after a merge.

## Test selection

- Vitest (logic / component / server / route): `lib/floating/views.test.mts` gains a run as the source (open beside a block view and once, `blockIdsOf`, read back and drop malformed). The window itself needs a Yorkie document; `floating-views.test.tsx` runs with no client, so its mirror is covered by E2E.
- Browser E2E (`e2e/`): `e2e/floating-windows.e2e.ts` gains the grouped window, including a deleted block's place.
- Container smoke (`.github/workflows/ci.yml`): no change — runs the E2E layer.
- Commands and observed results (fill in before the PR): `pnpm test` 87 files / 956 tests passed; lint, typecheck, `verify:docs`, comment budget clean. `pnpm e2e:isolated e2e/floating-windows.e2e.ts e2e/selection.e2e.ts e2e/chat-files.e2e.ts` (macOS arm64) after the `/simplify` changes: 9/9.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] With several blocks selected, a selected row's float button opens them in one window, in document order.
- [x] A block deleted from the run shows "원본 블록이 삭제되었습니다." in its place; the rest stay.
- [x] A run is saved and restored like a single block's view, and counts once against the cap.

## Cross-cutting

UC-070, FR-070-01/04/05. No SRS change: a view of several blocks is still a view of blocks. Stacked on #272 (the block selection); retarget to `main` once that merges.

## Review

Shipped as planned. `/simplify` tightened the mirror (a `Set`, unchanged blocks keep their objects, memoised body), merged the fit rules into `baseOf`, and limited `data-selection-action` to a button that opens the selection.
