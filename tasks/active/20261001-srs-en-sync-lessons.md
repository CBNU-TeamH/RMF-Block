# SRS-en.md as the agents' copy of SRS-ko.md, kept in sync by a required check — lessons

**Created**: 2026-10-01

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **CI never ran `verify:docs`.** #131 was written assuming it ran inside the required job.
  `ci.yml` runs `lint`, `test`, `build`, the comment budget, invariants and the container smoke test,
  and nothing else. The doc checks added in #71 and #82 have only ever run locally or by the PR
  template's checklist.

- **The changed-together rule, as #131 first wrote it, would have failed the PR that introduced it.**
  "Exactly one of the two files changed" is true of the PR that adds `SRS-en.md`, and of every
  translation-only fix after it. Korean is canonical, so the drift that matters is one way: a Korean
  change that never reaches the English. The check fails only on that.
- **Same line count was a coincidence, the row count was not.** Both files came out at 1,519 lines.
  The header note added two, and joining FR-040-02's three physical lines took two away. The
  `|`-line count per section is what the check compares, and that is 592 on both sides by
  construction.

## What we would do differently

- Write the structure check before translating, not after, and run it per section while translating.
  Counting `|` rows by hand per section worked, but the script would have done it for free.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **A check that is not in CI is a suggestion.** `verify:docs` existed for a month and was never
  run by CI. Any new check should state where it is enforced (which job, required or not) in the
  same PR that adds it. Candidate line for `AGENTS.md` §6, to be decided under #128.
