# Upload size boundary and Content-Disposition filename encoding — lessons

**Created**: 2026-09-21

## What surprised us

- **A test for the exact behaviour already existed and could not fail.**
  `serving.test.mts`'s "carries the original name, percent-encoded" used a filename
  containing `(` and `)` — the very characters #56 is about — but built its expected
  value with `encodeURIComponent`, the same function under test. It asserted that the
  implementation equals itself, so it passed with the bug and would have passed with
  almost any other bug too. Replaced with the literal encoded string.
- **The fix invalidated a passing test's premise, not just its value.**
  `upload.test.mts`'s "refuses an oversized body before parsing it" used
  `MAX_UPLOAD_BYTES + 1` as an oversized body. Once the pre-parse check has its own
  ceiling, that number is one the check should let through, so the test would have gone
  green for the wrong reason — the tiny file inside would have been accepted. It had to
  move to `MAX_UPLOAD_REQUEST_BYTES + 1` to keep testing the guard it was written for.
- The bug in #57 was not the comparison but the *constant being shared by two checks
  with different jobs*. Both lines read correctly in isolation.

## What we would do differently

- Nothing about the approach. Reverting both fixes and watching the new tests fail
  before keeping them was worth the two minutes: it is what proved the `(`/`)` test
  above was not already covering #56.

## Worth extracting

- **A test that builds its expected value with the function under test is not a test.**
  `docs/conventions.md` catalogues shapes that "behave correctly and are still wrong";
  this is one of them, and this repo has a live instance of it. Candidate for a sixth
  shape, or at least a line in `docs/testing.md` next to the existing rule about
  testing a limit at exactly its value.
- **When one constant gates two different checks, splitting it is the fix.** Raising it
  would have let a genuinely oversized file through. Worth a look wherever a limit is
  read in more than one place.
