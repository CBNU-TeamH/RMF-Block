# Exempt small files from the comment budget, and close out #65's gate

**Created**: 2026-09-09
**Issue**: #75 (fixes), #65 (part of — closes the false-positive gate criterion, doesn't close the issue itself)
**Design**: no new doc — this is a targeted edit to `docs/conventions.md`'s existing "comment budget" section.

## Milestones

### 1. Exempt files at or under the measured floor

- **What**: `scripts/comment-budget.mjs` skips the 25% ratio check entirely for a file at or
  under 40 code lines, instead of flagging it and asking the author to re-argue the same
  three-line-comment case every time.
- **Files**: `scripts/comment-budget.mjs`.
- **Reuse**: the 40-line floor isn't new — `docs/conventions.md`'s comment-budget section already
  measured and named it ("17 of 21 files still over budget hold 40 code lines or fewer"). #75
  re-measured after #74 and confirmed the same floor holds (0% of files over 40 lines fail; 76–88%
  at or under it do). This task acts on a floor the docs already derived, not a new one.
- **Done**: `pnpm comments` against the merge base no longer lists `next.config.ts` or any other
  ≤40-line file.

### 2. Update the docs to describe the exemption as implemented

- **What**: `docs/conventions.md`'s "The comment budget is a ratio, and a ratio has a floor" section
  currently ends in "say so in the PR and leave it" for small files. Rewrite that ending to say the
  script exempts them automatically, and add one line noting the 2026-09-23 promotion date stays
  advisory pending the still-unmeasured citation and review-cost gate criteria.
- **Files**: `docs/conventions.md`.
- **Reuse**: n/a — doc edit only.
- **Done**: the section no longer instructs an author to manually declare a small file "honestly
  over budget."

### 3. Close #75, update #65's gate status

- **What**: PR description includes `Fixes #75`. Post a comment on #65 summarizing which gate
  criteria this closes (false positives) and which remain open (citation count, S-1..S-5 caught
  something, review cost/repeat rate — all still genuinely unmeasured, not failed, since six
  checked PRs simply had nothing to cite) and note the team's decision to proceed into #66 without
  waiting on those.
- **Files**: none (GitHub only).
- **Done**: #75 closes on merge; #65 has a dated comment reflecting current gate status.

## Acceptance

- [ ] `scripts/comment-budget.mjs` exempts files ≤40 code lines; `SMALL_FILE_FLOOR` named and
      justified in a comment.
- [ ] `docs/conventions.md`'s comment-budget section matches the implemented behavior.
- [ ] `pnpm lint` / `pnpm test` / `pnpm build` / `pnpm verify:docs` clean.
- [ ] PR merged with `Fixes #75`; comment posted on #65.

## Cross-cutting

Touches the pre-commit hook's advisory output (`scripts/comment-budget.mjs --staged`) but not its
wiring — still non-blocking, `--strict` still unwired into CI. No SRS requirement; this is harness
tooling from #67's Phase 1.

## Review

<!-- filled in at the end -->
