# Repo doc consistency sweep + tasks/active archiving — lessons

**Created**: 2026-09-21

## What surprised us

- The local `main` ref was 6 commits stale, and the branch we were about to stack new work on
  (`docs/architecture-diagrams`) had actually already shipped — squash-merged as PR #111. Checking
  `git fetch` + `gh pr list` before picking a base branch caught this; branching off the stale
  local state would have produced a confusing PR carrying unrelated already-shipped diffs.
- Two docs (`docs/conventions.md`, `docs/testing.md`) cited GitHub issue numbers as if they were
  live trackers, but both issues were already closed. `gh issue view <n>` settled this in seconds
  each time — cheaper than inferring staleness from repo state alone, and it's the only way to
  know an issue was reopened or split, which grep can't tell you.
- The runtime diagrams' `.architecture.json` files are explicitly "the editable Archify sources"
  (`docs/diagrams/harness/README.md`), but Archify itself — the tool that renders them to `.html`
  — isn't available in this environment. Hand-editing the JSON is the documented workflow for the
  source; it's the `.html` regeneration step that has to wait for someone with Archify access.

## What we would do differently

- Nothing — the sequence (fetch/confirm base branch → read every doc end to end → check every
  cited issue's live state → edit → archive) held up.

## Worth extracting

- **Check `gh issue view` before trusting any doc's issue citation as "still open."** A closed
  issue number in a doc is a stale-doc signal that's cheap to check and easy to miss by reading
  the repo alone.
- **`scripts/verify-docs.mjs`'s dead-link check explicitly skips external URLs**, so nothing
  automated ever catches a doc citing a GitHub issue that's since closed — both `#26` and `#66`
  drifted independently for exactly this reason, and will again. Flagged by `/simplify`'s altitude
  pass; not built here because it's new tooling outside this task's scope, but a `verify-docs`
  step that runs `gh issue view` on every cited issue number and flags closed ones would close
  this gap generally instead of one citation at a time.
