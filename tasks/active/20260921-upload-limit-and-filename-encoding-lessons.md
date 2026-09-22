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

- **`comment-budget` reports a file the moment you touch it, at whatever ratio it already had.**
  `lib/files/upload.ts` measured **33.8%** against a 25% budget *before* this task — it had simply
  never been reported, because the script only looks at files changed against the merge base. This
  change pushed it to 38.2%, and moving the new rationale into `docs/design/api.md` brought it back
  to 33.7%. Getting it under 25% would mean rewriting rationale comments this task did not author,
  which `AGENTS.md` §3 ("surgical changes") argues against.

## Worth extracting

- **A test that builds its expected value with the function under test is not a test.**
  `docs/conventions.md` catalogues shapes that "behave correctly and are still wrong";
  this is one of them, and this repo has a live instance of it. Candidate for a sixth
  shape, or at least a line in `docs/testing.md` next to the existing rule about
  testing a limit at exactly its value.
- **When one constant gates two different checks, splitting it is the fix.** Raising it
  would have let a genuinely oversized file through. Worth a look wherever a limit is
  read in more than one place.
- **`comment-budget`'s promotion (#92, earliest 2026-09-23) needs the existing over-budget
  files counted first.** Because the script reports only changed files, today's clean runs say
  nothing about how many files are already over. Under `--strict` the first PR to touch any of
  them fails CI on comments it did not write — the author's only ways out being to rewrite
  someone else's rationale or to not touch the file. Worth measuring the whole tree before the
  promotion date rather than discovering the count one PR at a time.
