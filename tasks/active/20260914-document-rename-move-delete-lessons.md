# UC-023: rename, move and delete a document, from the UI — lessons

**Created**: 2026-09-14

## What surprised us

- The feature was already three-quarters built. `PATCH`, `DELETE`, the cascade, the cycle check
  and both broadcasts were written, commented and tested; only the buttons were missing. Reading
  `ROADMAP.md` against the code found it — reading the code alone would have suggested the
  requirement was unimplemented rather than unreachable.

## What we would do differently

- ...

## Worth extracting

- A requirement can be fully implemented on the server and completely absent to a user. Neither
  "is there an endpoint" nor "is there a test" answers whether a UC is done; only "can someone do
  it" does. Worth a line in whatever tracks Phase completion.
