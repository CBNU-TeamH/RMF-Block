# Make the PR-prep steps hard to skip by accident

**Created**: 2026-09-07
**Issue**: none — found live, during PR #77's review.
**Design**: no new doc. This corrects `AGENTS.md` §6, which already covers PR requirements.

## Why now

PR #77 shipped without following two things this repo's own harness already documents:
`skills/README.md` says `/code-review low` runs *before opening a PR* and `/simplify` runs
*while working*, both from a Sonnet session — neither ran until asked for, after the PR was
already open. Separately, the PR's description was written free-form instead of from
[`.github/pull_request_template.md`](../../.github/pull_request_template.md) — `gh pr create
--body` bypasses the template entirely when a body is supplied directly, so nothing forced the
template's structure to actually get used.

Neither skill fires automatically, by design (`skills/README.md`: *"None of these fire
automatically... don't run one unprompted"*) — an LLM call can't live in a git hook the way
`comment-budget`/`verify-docs` do. So the fix here is a documentation one: name the missing step
explicitly in `AGENTS.md` §6, at the point an agent or teammate is about to open a PR, rather than
leaving it implied by the PR template's own checklist (which only catches the omission *after* the
fact, when filling out a checkbox honestly requires already knowing to have run the thing).

A CI-enforced check that the PR body actually contains the template's structure was considered and
deferred — filed as a comment on #65 instead of built now, since it needs a `pull_request`-triggered
workflow (this repo has avoided adding those without discussing it first) and can't verify `/simplify`
or `/code-review` actually *ran*, only that the checklist lines aren't blank.

## Milestones

### 1. `AGENTS.md` §6

- **What**: a new bullet, between "One PR per task" and "Before merging", naming both gaps:
  start the PR body from the template file itself, and run `/code-review low`/`/simplify` before
  opening the PR if they haven't run yet this task.
- **Files**: `AGENTS.md`.
- **Done**: `pnpm verify:docs` clean (no new dead link), and the new bullet reads as an
  instruction an agent reading this file top-to-bottom would actually follow, not just a
  restatement of what the PR template already asks.

## Acceptance

- [x] `pnpm verify:docs` clean.
- [x] Comment left on #65 naming the CI-enforcement idea as deferred, not silently dropped.

## Cross-cutting

Nothing else changes. This is a wording fix to an existing section, not new workflow.

## Review

Filled in at the end.
