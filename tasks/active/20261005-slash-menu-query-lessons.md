# The `/` menu's query — lessons

**Created**: 2026-10-05

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- #103 was reachable without a browser. Its body filed it next to #52 as IME territory, but the bug is in *our* handler order (the only query sync sat behind the composing guard), so `fireEvent.compositionStart` → `input` → `compositionEnd` in happy-dom reproduced it exactly. #52 differs: it depends on what the browser's IME does to the textarea, which is why it still needs #61.
- `docs/design/document-editing.md` justified two guards with one reason ("only a plain text block converts on a marker, and only a plain text block opens the `/` menu"). The reasons were never the same: a marker *re*-asks for the type you are in, while every `/` item converts *to* a type. Sharing a sentence is what kept the menu out of headings.

## What we would do differently

- Escape dismisses the menu, but the query is recomputed from the text, so the next keystroke brings it back. Unchanged here (the menu with matches always behaved this way); filed as #148.

- Closing a popup on blur needs `preventDefault` on mousedown over the *whole* popup, not only on its options — otherwise its own scrollbar steals focus and closes it. The options here already did it; the container did not, because nothing closed on blur until review asked for it.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- `docs/testing.md` could say it outright: an IME bug in *our* event handling (which handler runs when) is a component test — `fireEvent.composition*` is enough. Only a bug in what the browser's IME does needs a real browser.
