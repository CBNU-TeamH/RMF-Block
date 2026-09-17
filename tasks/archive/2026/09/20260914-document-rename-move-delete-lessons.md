# UC-023: rename, move and delete a document, from the UI — lessons

**Created**: 2026-09-14

## What surprised us

- The feature was already three-quarters built. `PATCH`, `DELETE`, the cascade, the cycle check
  and both broadcasts were written, commented and tested; only the buttons were missing. Reading
  `ROADMAP.md` against the code found it — reading the code alone would have suggested the
  requirement was unimplemented rather than unreachable.

- **`position: fixed` is relative to the nearest transformed ancestor, not the viewport.** The menu
  is `fixed` so `overflow-hidden` on the table cannot clip it, and it was landing 49px too high and
  14px off to the side. The cause was `-translate-y-1/2` on the wrapper that centres it in its
  cell: a `transform` makes that element the containing block. Centring with flex instead fixed it
  exactly. Worth remembering because nothing about the symptom points at the transform.

## What we would do differently

- **Read `docs/ui/` before designing a screen, not after.** The first attempt put four inline
  buttons in the row, absolutely positioned, overlapping the MODIFIED and CREATED columns. The
  team's 확정 wireframe (`docs/ui/dashboard/dashboard.dc.html`) already specified a ⋯ overflow menu
  in a reserved 30px trailing column — the exact fix — and had done since 2026-08-26. The rework
  was avoidable by reading one file.

## Worth extracting

- ~~A requirement can be fully implemented on the server and completely absent to a user...~~ —
  **promoted 2026-09-16** to `ROADMAP.md`'s intro.
