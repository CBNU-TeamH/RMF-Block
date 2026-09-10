# Testing strategy doc (issue #66, track C2) — lessons

**Created**: 2026-09-10

## What surprised us

- Reading `app/api/documents/route.ts` before writing the route-handler section (rather than
  assuming route handlers were too thin to bother with) turned up a concrete, already-fixed,
  currently-unguarded bug named in the file's own comment (a malformed JSON body used to become a
  500 instead of a 400) — the exact evidence needed to justify the layer, sitting in the first
  file checked.

## What we would do differently

- ...

## Worth extracting

- ...
