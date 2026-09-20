# Make the PR-prep steps hard to skip by accident — lessons

**Created**: 2026-09-07

## What surprised us

- `gh pr create --body "..."` silently skips `.github/pull_request_template.md` entirely — the
  template only auto-populates when no body is supplied (interactive or `--web`). A script-driven
  PR open has no mechanical nudge toward the template at all; it's on the author to open the file
  and use it.
- The two review skills (`code-review`, `code-simplifier`) already had their correct timing
  written down in `skills/README.md` (`/code-review low` before opening a PR, `/simplify` while
  working) — the gap wasn't missing documentation, it was that nothing pointed an agent at that
  file specifically at the moment of opening a PR, and the deliberate "don't auto-run" design means
  there's no mechanical backstop if the reminder is missed.

## What we would do differently

- ...

## Worth extracting

- A CI check that a PR's body contains the template's section headers, so an omitted section is
  visible on the PR itself rather than only in a since-forgotten local habit. Deferred, not built —
  see the todo file's "Why now" section and the comment on #65.
