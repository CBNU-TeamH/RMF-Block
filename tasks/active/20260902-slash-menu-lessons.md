# The `/` block menu — lessons

**Created**: 2026-09-02

## What surprised us

- **The menu had to live in the text block, not the editor.** The instinct was
  to put it beside the other block operations. But it has to swallow Enter
  *before* the split handler reads it, and the query is the textarea's own text
  — the editor would have needed a prop round-trip to decide whether Enter meant
  "choose" or "split", one render behind the keystroke.
- **`onMouseDown`, not `onClick`, on a menu item.** A click blurs the textarea
  first, so by the time the handler runs the caret the conversion is supposed to
  land in is gone.
- **A fragment is safe where a wrapper is not.** `text-block.tsx` must keep a
  bare `<textarea>` as its root or a type conversion remounts it and drops the
  caret. Returning `<>{textarea}{menu}</>` keeps that true, and making the menu
  `absolute` keeps it out of the row's flex layout as well.

## What we would do differently

- ...

## Worth extracting

- **The item list is the seam for the next two triggers.** A block-handle menu
  and a "+" button both want the same eleven items with a different opener;
  `SLASH_ITEMS` and `slashMenuItems` are already independent of how they are
  shown.
