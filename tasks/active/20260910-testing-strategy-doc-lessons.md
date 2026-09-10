# Testing strategy doc (issue #66, track C2) — lessons

**Created**: 2026-09-10

## What surprised us

- Reading `app/api/documents/route.ts` before writing the route-handler section (rather than
  assuming route handlers were too thin to bother with) turned up a concrete bug, fixed by a
  runtime check but with no regression test guarding it, named in the file's own comment (a
  malformed JSON body used to become a 500 instead of a 400) — the exact evidence needed to
  justify the layer, sitting in the first file checked.
- CodeRabbit's review of the doc (PR #88) caught a real precision gap even though CI was green:
  "invalid body maps to 400" was written as a blanket per-handler requirement, but GET handlers
  don't parse a body, and an *unauthenticated* request with a malformed body should still map to
  401 (auth runs before body parsing), not 400. A doc about testing precision benefited from the
  same precision applied to itself.

## What we would do differently

- ...

## Worth extracting

- ...
