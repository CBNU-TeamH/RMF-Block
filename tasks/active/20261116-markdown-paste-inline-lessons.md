# Paste Markdown structure, and draw inline formatting — lessons

**Created**: 2026-11-16

## What surprised us

- A textarea's own height is computed from the raw text, which is longer than what the drawing shows; the textarea takes the drawing's height while it shows, or rows would carry blank space.
- `HEADING_CLASS` carries a top margin; the drawing reuses the textarea's classes with `margin: 0`, since it is placed at the textarea's own offset (an `m-0` class would lose to `mt-*` by stylesheet order).

## What we would do differently

- ...

## Worth extracting

- ...
