# List nesting with Tab, and a placeholder — lessons

**Created**: 2026-09-07

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **The feature exposed a latent bug in `changeBlockType`.** `TypeFields` is treated as the whole
  target state, so any field it does not name is dropped — including `depth`. That was invisible
  while `depth` was always 0. The moment Tab could set it, using the `/` menu on an indented item
  silently flattened it, and so did typing a markdown marker into one. Fixed at the two call sites
  with `preservingDepth`, which keeps `changeBlockType`'s contract intact rather than special-casing
  it inside the operation. **A field that nothing can set hides every bug about it.**

- **`orderedListNumbers`'s own header said it was about to be wrong.** It read *"Depth is ignored:
  nothing yet lets a list item nest"* — a comment that named its own expiry condition, and this task
  is that condition. Rewriting it was part of milestone 1, not a follow-up. Comments that say what
  would falsify them are worth writing.

## What we would do differently

- **Verify a DOM query before trusting what it reports.** `el.querySelector('span')` was reading the
  *drag handle*, which is the first `<span>` in every block row, not the marker slot. That made a
  browser check report "the markdown shortcut is broken" through four rounds of debugging when the
  shortcut had worked the whole time. The fix was to anchor on the row (`div.flex.items-start`) and
  take its `firstElementChild`. **A measurement that disagrees with a shipped, tested feature is more
  likely wrong than the feature.**

- **Synthetic input does not reach React 19's event system.** Neither
  `dispatchEvent(new InputEvent('input', …))` after the native value setter, nor calling
  `__reactProps.onInput` directly, opened the `/` menu — while a real click on a button worked. Any
  browser check of this editor has to use real keyboard and mouse events, and a background tab does
  not receive them at all (its `document.activeElement` stays `BODY`).

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **A DOM assertion in a browser check should anchor on a stable container, never on a bare tag.**
  Every block row starts with the drag handle `<span>`, so `querySelector('span')` finds that in
  each of the twelve block types. Proposal for a browser-checking note in `AGENTS.md` §2's "Run and
  verify": query from the row element down, and print what the selector matched before believing
  what it says.

- **A conversion that drops a field it did not name is a class of bug, not one bug.** `OWNED_FIELDS`
  currently holds `level`, `style`, `depth`, `checked`. `depth` is now protected by
  `preservingDepth`; the other three are not, and the same silent-flatten shape applies to any of
  them the moment two types share one. Worth a rule in `document-editing.md` about which fields
  survive which conversions, rather than a second helper each time it bites.
