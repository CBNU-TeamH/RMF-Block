# Promote comment-budget to a required CI check — lessons

**Created**: 2026-09-23

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **`--strict` in CI as first sketched would have passed every PR.** `actions/checkout` fetches
  one commit by default, so there is no `origin/main` to take a merge base against, and the script
  answered a missing base with "skipping" and exit 0. A gate that cannot see its base has to fail,
  not skip.
- **A ratio alone would have failed a deletion.** Deleting code from an inherited file raises its
  ratio without touching a comment — `occupancy.ts` went 37.6% → 38.1% that way in the negative
  test. That is why the ratchet needs both "ratio rose" and "comment lines grew", not either one.

## What we would do differently

- ...

## Worth extracting

- ...
