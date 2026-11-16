# Paste Markdown structure, and draw inline formatting

**Created**: 2026-11-16
**Issue**: none — requested directly ("맨 앞의 마크다운만 적용되고 그 뒤의 볼드 처리 같은 것들은 잘 적용이 안돼")
**Design**: [document-editing.md, "Inline formatting" and "Pasting more than one line"](../../../../docs/design/document-editing.md#inline-formatting)

## Milestones

### 1. Block structure on paste

- **What**: a multi-line paste reads nested lists, GFM checklists, dividers, fenced code (one block), GFM tables and deeper headings.
- **Files**: `lib/blocks/paste.ts`, `lib/blocks/paste.test.mts`, `app/(workspace)/documents/[id]/editor.tsx`.
- **Reuse**: `create.ts` builders, `editTableCell`, `insertBlockAfter`, the existing first-line-reuses-the-block rule.
- **Done**: the user's sample pastes as heading, nested list, checklist, divider, one code block and a table.

### 2. Inline formatting (option A: stored as typed, drawn while not editing)

- **What**: `**bold**`, `*italic*`, `<u>underline</u>`, `~~strike~~`, `` `code` `` and links draw formatted while a block is not focused; Ctrl/Cmd+B, I, U wrap the selection.
- **Files**: `lib/blocks/inline-markdown.ts` (+ test), `app/(workspace)/documents/[id]/inline-text.tsx`, `text-block.tsx` (+ test), `version-history.tsx`, `floating-views.tsx`, `docs/design/document-editing.md`, `e2e/markdown-paste.e2e.ts`.
- **Reuse**: the textarea surface unchanged; `commitLocal` for the shortcut edit.
- **Done**: the E2E sees `<strong>` over an unfocused block, none while it is focused, and a peer sees a Ctrl/Cmd+B edit bold.

## Test selection

- Vitest (logic / component / server / route): `paste.test.mts` (structure cases; list fields carry `depth`; `####` is now a level-3 heading), new `inline-markdown.test.mts`, `text-block.test.tsx` (drawing, redraw after a peer's edit, code left alone, shortcuts).
- Browser E2E (`e2e/`): new `e2e/markdown-paste.e2e.ts` — the sample's structure and inline drawing; Ctrl/Cmd+B seen bold by a peer.
- Container smoke (`.github/workflows/ci.yml`): no change — runs the E2E layer.
- Commands and observed results: `pnpm test` 931 passed; `pnpm lint`, `pnpm typecheck`, `pnpm verify:docs`, `pnpm comments` clean; `pnpm e2e:isolated` 39 passed, 1 failed — `tabs.e2e.ts:4`, which fails locally on `main` too and passes in CI (the two `recovery.e2e.ts` diagnostics are `test.fail`). `markdown-paste.e2e.ts` 2/2.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] The sample in the request pastes with its bold drawn and its nested item nested.
- [x] Storage, sync and IME paths are unchanged: inline Markdown is plain text in Yorkie.

## Cross-cutting

FR-022 (block editing). No SRS, storage or API change. Decision recorded with the requester: option A (drawn over the textarea) rather than rich text (contenteditable + Yorkie text attributes), which would rebuild IME and remote-edit handling (ADR-008).

## Review

- `/code-review low`: `hasInlineMarkup` was unused outside tests — replaced by `hasMarks(segments)`, used by the text block. (Its other finding, a dead `preservingDepth` import, was a false positive: two other call sites.)
- `/simplify`: applied `fillTable` for pasted cells, `createTable(rows, columns)`, depth shifted once (the `listDepth` clamp in `createList`/`changeBlockType` is the only clamp), `holdsText` from the block registry, one `drawsInline` flag, `InlineText` takes text only, overlay margin reset instead of a class regex, one observer per drawn block that also watches the drawing, `setShown` skipped while focused, `autoGrow` skipped while drawn, a plain-text fast path and a bounded close search in `parseInline`, E2E helpers, comments cut to citations. Skipped: making the overlay a structural sibling (the textarea stays the row's root by contract), one marker table shared with typing shortcuts (would change what typing converts), one shared ResizeObserver and a bulk `fillTable` (large documents/tables only).

