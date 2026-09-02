# The `/` block menu, and the divider it can finally create

**Created**: 2026-09-02
**Issue**: none — comes out of the editor gap review, and out of
[`20260901-editor-structure-audit-todo.md`](20260901-editor-structure-audit-todo.md),
whose `BLOCK_KINDS` this builds on.
**Design**: no new doc. `docs/design/document-editing.md` already fixes the
twelve block types and their stored shapes; this adds a way to reach them.

## Why

UC-022's basic flow opens with *"사용자 1이 '/'로 파일 블록을 선택하거나"*, and there
was no `/` anywhere in the app. The only way to change a block's type was a
markdown marker, and the markers cover six of the twelve types.

The sharper problem is what that left unreachable. **A divider had no way into a
document at all** — no marker, no upload, no menu — despite being one of the
twelve types `docs/SRS-ko.md` §4.1 names. A PDF could only arrive by dragging a
file in or using the footer button.

## What this adds

| | |
| --- | --- |
| `lib/blocks/slash-menu.ts` (+ test) | the item list, `detectSlashQuery`, `slashMenuItems`, `moveHighlight` — the whole decision, pure and testable |
| `text-block.tsx` | the session: opens on a leading `/`, filters as you type, owns ↑↓/Enter/Esc while open, renders the menu |
| `editor.tsx` | `handleSlashSelect` — convert, insert a divider, or open the PDF picker |
| `divider-block.tsx` (new) | the renderer the menu now requires |

**The slash must be the block's first character.** Mid-text `/` is left alone on
purpose: a URL, a date and a fraction all contain one, and the existing trigger
(`detectMarkdownShortcut`) already matches on the whole of a block's text rather
than a position in it. One rule to remember instead of two.

**The menu lives in `text-block.tsx`, not the editor.** It has to intercept
Enter before the split handler sees it, and it needs the text and the caret —
both of which are that component's. The editor gets a named action and does the
document work, exactly as it already does for markdown shortcuts.

**A divider goes *above* the block, and the caret stays put.** It has no caret
of its own, so replacing the block would leave nowhere to type; this way the
line under the rule is already there and already focused.

## Acceptance

- [x] `pnpm lint`, `pnpm test`, `tsc --noEmit`, `pnpm build`.
- [x] `/` opens all eleven items; `/제목` narrows to three; `/hr` to one.
- [x] ↑↓ moves the highlight and wraps; Enter converts; Esc closes and leaves
      the typed text alone.
- [x] With no match the menu does not open and Enter splits the block again.
- [x] A conversion reaches the document (`/제목` + ↓ + Enter → `heading(2)`).
- [x] `/hr` puts a `divider` above the caret's block and the caret stays.
- [x] The divider renders as an `<hr>` and can be deleted, asking once.
- [ ] The PDF item opens the file picker — **not automatable**: it is a native
      dialog, and driving it would hang the browser session. The wiring is the
      same input the footer button already uses; verify by hand.

## Cross-cutting

- **SRS**: UC-022 기본 흐름 1, and §4.1's 구분선 블록 finally reachable.
- **Not touched**: the block schema, `changeBlockType`, the markdown shortcuts —
  all three keep working exactly as they did, and the menu reuses them.
- **Left open**:
  - Image and generic-file items. The upload endpoint refuses both until they
    have renderers (FR-022-14's other two legs).
  - The document-link and block-link items, which need the document tree.
  - A block-handle menu (Notion's ⋮⋮ click). Same items, different trigger —
    worth doing once, from this same list, when someone wants it.

## Review

Filled in at the end.
