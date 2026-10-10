# Drift audit: every design doc, after admin, tabs, the .data/ layer and packaging — lessons

**Created**: 2026-10-10

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- An independent second review (Codex) found 10 more A and three real code bugs the first audit
  missed, and overturned two "confirmed" A. A single audit's verifier checks precision, not recall.
- A D item, approved on the checklist, still deleted a measurement figure; only the round-3 lens
  ("the rest of the diff") caught it. "Drop the history" and "keep the figure" collide inside one
  sentence, and the editor resolved it the wrong way.
- Editors in a worktree without `node_modules` cannot run `verify-declarations` or
  `gen-endpoints --check` (they import `typescript`); four of five skipped them and said so, one
  symlinked the main checkout's `node_modules`. The coordinator's run in the main checkout is the
  real one.

## What we would do differently

- Put "keep every measurement figure; reword only the narration around it" into each D item's
  package as a DECISION, instead of trusting the default in the skill's references.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- The skill could say: a full audit benefits from a second, independent reviewer (another model or
  session) before the checklist is decided. Left for the user to decide; not promoted here.
