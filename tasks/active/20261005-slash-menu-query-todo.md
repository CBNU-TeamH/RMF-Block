# The `/` menu's query: IME input, prefix matching, every text block, no-results row

**Created**: 2026-10-05
**Issue**: #103, #145
**Design**: [`docs/design/document-editing.md`](../../docs/design/document-editing.md) — "Leaving a code block" holds the rule this task changes (which blocks open the `/` menu).

All four slices touch the same few lines: where `TextBlockView` computes the `/` menu's query
and what `slashMenuItems` does with it. That is why #103 and #145 ship together — #145's trigger
change edits the line #103's fix moves.

## Milestones

### 1. Recompute the query when an IME composition ends (#103, part 1)

- **What**: typing `/페이지` with a Korean IME filters the menu to 페이지, instead of leaving it showing every item until the next non-composing keystroke.
- **Files**: `app/(workspace)/documents/[id]/text-block.tsx`, new `text-block.test.tsx` beside it.
- **Reuse**: `detectSlashQuery` (`lib/blocks/slash-menu.ts`). The query sync already in `onInput` moves into one local function both handlers call — the two copies would drift the way `onInput` and `onCompositionEnd` already have.
- **Done**: a component test fires `compositionstart` → `input` (`/페이지`) → `compositionend` and sees only 페이지 in the listbox; it fails with the old `onCompositionEnd`.

### 2. Match on word prefixes, not any substring (#103, part 2)

- **What**: `/eading` no longer finds 제목; `/head`, `/제`, `/목록`, `/1` still find what they should.
- **Files**: `lib/blocks/slash-menu.ts`, `lib/blocks/slash-menu.test.mts`.
- **Reuse**: `slashMenuItems` keeps its shape — only the predicate changes, applied to each word of the label and each keyword.
- **Done**: unit tests for the new misses and the existing hits pass.

### 3. Open the `/` menu in every text-bearing block except code (#145, part 1)

- **What**: `/` at the start of a heading, list, checklist or quote opens the menu (so `/텍스트` turns a heading back into a paragraph). A code block still treats `/` as source text.
- **Files**: `text-block.tsx`, `text-block.test.tsx`, `docs/design/document-editing.md`.
- **Reuse**: `handleSlashSelect` in `editor.tsx` already handles every action without looking at the block's type (convert, insert before/after, open a picker), so the editor needs no change. The markdown-shortcut guard and the placeholder hint stay plain-text only.
- **Done**: a test renders a heading and a code variant; `/` opens the menu in the first and not the second. The design doc says the new rule.

### 4. Show "결과 없음" instead of hiding the menu (#145, part 2)

- **What**: a query that matches nothing shows a non-selectable 결과 없음 row instead of the menu vanishing mid-word. Keys keep their normal meaning while it shows — Enter splits, arrows move between blocks — and Escape dismisses it.
- **Files**: `text-block.tsx`, `text-block.test.tsx`.
- **Reuse**: `slashOpen` (items > 0) stays the condition for the menu owning keys; only rendering gets a second condition (`slashQuery !== null`).
- **Done**: `/zzzz` shows 결과 없음; Enter still calls `onSplit`; Escape removes the row.

## Acceptance

- [ ] `pnpm vitest run lib/blocks/slash-menu.test.mts "app/(workspace)/documents/[id]/text-block.test.tsx"` passes.
- [ ] The milestone 1 test fails against the old `onCompositionEnd`.
- [ ] `pnpm lint` and `pnpm verify:docs` pass.
- [ ] By hand, in the container: `/페이지` typed with a Korean IME filters the menu; `/텍스트` in a heading converts it; `/` in a code block stays text.

## Cross-cutting

- FR-022-01 (create blocks), UC-022 basic flow ("'/'로 블록을 추가").
- `docs/design/document-editing.md` "Leaving a code block" — the "only a plain text block opens the `/` menu" sentence changes.
- #52 sits on the same `onCompositionEnd` but is a different consequence (remote edits replayed at stale offsets); not touched here.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
