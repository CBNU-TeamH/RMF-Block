# Floating window gaps: bring to front, Escape, and a cap on open views — lessons

**Created**: 2026-10-21

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- A press inside a PDF `<iframe>` fires no `focus` or `focusin` on the page in Chrome. The page only sees its own `window` blur, with `document.activeElement` already the iframe. A unit test that fired `focus` on an element passed; the real click in the browser did not raise the window.
- `assert.equal` on two DOM nodes, when it fails, builds a diff big enough that the Vitest worker is killed (`SIGKILL`), not a failed assertion. Compare `a === b` and assert the boolean.
- An element's `.click()` from a script does not move focus. A browser check of anything focus decides (Escape here) needs a real click, or it tests a state no user reaches.

## What we would do differently

- Check focus and pointer behaviour in the real browser before writing the unit test that pins it, when an iframe or a plugin is involved.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- One key, one layer: a handler that uses Escape calls `preventDefault()`, and an outer layer that closes on Escape skips a `defaultPrevented` event (`floating-frame.tsx`). A native `<dialog>` is the exception, since it never prevents its own key.
