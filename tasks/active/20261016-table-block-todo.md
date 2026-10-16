# Simple collaborative table blocks

**Created**: 2026-10-16
**Issue**: No dedicated issue found; related: #145, #148, #185. Local-only delivery requested.
**Design**: [Document editing](../../docs/design/document-editing.md)

## Milestones

### 1. Table model and collaboration

- **What**: One table block with stable row/column IDs and CRDT cell text; add/delete axes and preserve concurrent edits.
- **Files**: block model, operations, revision snapshots and tests under `lib/blocks/`.
- **Reuse**: Existing Yorkie block array, Text editing and history.
- **Done**: Tables round-trip through storage and revisions; structure and text converge.

### 2. Editor and requirements

- **What**: `/table` inserts a 3×3 table with header row, cell editing, Tab navigation, row/column controls and paragraph below.
- **Files**: document editor/views, SRS pair, document-editing design.
- **Reuse**: TextBlockView's IME binding, block movement/deletion and occupancy.
- **Done**: Two browsers can edit and reload tables; history and revision preview/restore preserve them.

### 3. Notion-style controls and PR #208 review

- **What**: Replace the always-visible toolbar with hover controls: "+" at every column/row boundary and at the right and bottom ends, a grip per column and row whose click opens a menu (add before/after, delete), and a hover-only "표 삭제". Fix the design-doc heading order/levels CodeRabbit flagged and record the table snapshot/restore note in `docs/design/version-history.md`.
- **Files**: `table-block.tsx` (+ test), `e2e/table.e2e.ts`, `docs/design/document-editing.md`, `docs/design/version-history.md`.
- **Reuse**: Existing `onChangeAxis` / `onDeleteAxis`, pending-focus logic and the fixed-position menu pattern of `document-row-menu.tsx`.
- **Done**: Controls appear on hover or keyboard focus only; every existing row/column behavior (minimum 1×1, focus after add/delete, Shift+Tab to the controls) still holds.

## Test selection

- Vitest (logic / component / server / route): new table model/operation/snapshot tests and cell navigation/IME component tests; registry/slash tests extended. No server/route changes.
- Browser E2E (`e2e/`): table insertion, cell convergence, concurrent structure changes, deletion/input race, undo/redo, reload and revision restore.
- Container smoke (`.github/workflows/ci.yml`): run existing disposable-stack checks; no startup/auth/network behavior changed.
- Commands and observed results:
  - `pnpm verify:docs`: passed, including SRS synchronization and ownership checks.
  - `pnpm typecheck`: passed, test sources included.
  - `pnpm lint --ignore-pattern '.claude/worktrees/**'`: passed. Bare `pnpm lint` includes an unrelated existing perf-internet-wifi worktree and fails on its design assets; no unrelated config/files changed.
  - `pnpm comments --staged --strict`: passed (the inherited revision-snapshot comment ratio was reported, not worsened).
  - `pnpm test --max-workers=2`: final run passed (72 files, 793 tests).
  - Focused model/component regressions: 17 passed after both review fixes.
  - Production `pnpm build` in the disposable Docker image: passed; existing instrumentation Edge Runtime warning remains.
  - Yorkie invariants and the two existing CI HTTP smoke scripts: passed on the disposable stack, with only address/project/temporary-cookie-path substitutions.
  - Full Playwright suite via `pnpm e2e:isolated`, after the hover-controls change: 26 passed. The two `diagnostic:` recovery specs are `test.fail` known defects and report as expected failures. An earlier run had failed two table cases because of wrong test expectations (see lessons).
  - `git diff --check`: passed.

## Acceptance

- [x] Required tests and checks pass; limitations recorded.
- [x] Initial 3×3 grid, header, row/column controls (minimum 1×1), Tab/Shift+Tab and Enter work.
- [x] Text/structure collaboration, persistence, undo/redo and revisions preserve the table.
- [x] Agreed SRS change appears in both languages; design and task lessons updated.
- [ ] Review and simplification complete; task archived and committed locally, with no push or PR.

## Cross-cutting

Team agreement for a thirteenth block confirmed by the user. Extend SRS §4.1 under UC-022.
No migration for existing documents or REST API additions. Exclude database features, merged cells,
column resizing, Markdown conversion and multi-cell paste. Preserve unrelated untracked notes.

## Review

Branch: `feat/table-block`.

A `/simplify` pass (one sub-agent) merged the duplicated remote-apply step in `TextBlockView`, shared the axis helpers in `TableBlockView`, reused `flattenNodes` in the revision snapshot and limited the cell rescan to events that touch a table. A `/code-review low` pass (one sub-agent) found one issue: every remote cell keystroke rebuilt the whole block list because a cell path matches `touchesBlockList`. Cell edits now go through their handler, and only an unmounted cell falls back to the rebuild. Declined: the nine no-op `unusedTextActions` props (a `TextBlockView` props rework, follow-up).

PR #208 feedback: CodeRabbit flagged the table section's heading level and its order before the
block-link section in `docs/design/document-editing.md` (fixed: both are `###`, 12 before 13), and
the owning-docs reminder asked for `docs/design/version-history.md` (a note on how table cells are
flattened and restored). The controls were then reworked to the Notion-style hover UI (milestone 3).
CodeRabbit's second pass on the hover controls: the axis menu now closes when focus leaves it (not
between its items) and is clamped to the viewport vertically. Both are covered by component tests;
the E2E suite was not re-run for this change because the Docker stack was in use.
