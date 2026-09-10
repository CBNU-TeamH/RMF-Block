# Route-handler tests — lessons

**Created**: 2026-09-10

## What surprised us

- The plan's own "spot-check a mutation" verification step earned its keep immediately: the
  first version of `documents/route.ts`'s GET auth-gate test only covered the case where both
  `member` and the host secret are falsy. Flipping the real code's `&&` to `||` didn't fail that
  test — with every input false, `&&` and `||` agree. A gate test needs a case where exactly one
  side is true to actually pin down which operator is correct. Added that case to both
  `documents/route.test.ts` and `documents/[id]/route.test.ts` before trusting either.
- 5 of 11 route handlers delegate to one shared helper (`lib/auth/current-member.ts`) that had
  never been tested on its own — a single-point gap wider than any individual route's wiring.
- `chat/route.ts`'s 400-for-empty-message behavior was real but accidental: no explicit check of
  its own, just a downstream `ChatValidationError` the route happens to catch and map. Worth a
  test precisely because nothing was pinning it down before.

## What we would do differently

- ...

## Worth extracting

- ...
