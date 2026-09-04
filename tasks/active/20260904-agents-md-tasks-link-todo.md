# AGENTS.md doc-routing table: spell out tasks/active, tasks/archive — todo

**Created**: 2026-09-04
**Issue**: #65 (Phase 1, scope note — see `docs/design/architecture.md`-style cross-reference below)
**Design**: none — a one-line prose fix, not a design change.

## Milestones

### 1. Fix the dangling shorthand

- **What**: `AGENTS.md`'s doc-routing table (§4) reads `` [`tasks/`](tasks/) (`active/`, `archive/`) `` —
  the backtick-quoted `active/` and `archive/` are bare shorthand that `scripts/verify-docs.mjs`'s
  dead-link checker resolves from the repo root (this project's own convention for backtick-quoted
  prose paths), where no such top-level directories exist. Spell them out as `tasks/active/` and
  `tasks/archive/` so the line is unambiguous to both a human reader and the checker.
- **Files**: `AGENTS.md`.
- **Reuse**: nothing to reuse — single-line prose edit.
- **Done**: `node scripts/verify-docs.mjs` shows one fewer dead-link finding than on `main` (9 → 8),
  and the removed one is this line.

## Acceptance

- [ ] `AGENTS.md`'s doc-routing row reads `tasks/active/`, `tasks/archive/` instead of `active/`, `archive/`.
- [ ] `node scripts/verify-docs.mjs` dead-link count drops from 9 to 8, with this line's finding gone.
- [ ] No other line in `AGENTS.md` changed.

## Cross-cutting

Found while running Track C's (`chore/verify-scripts`, PR #71) new `scripts/verify-docs.mjs` against
`main` — 9 pre-existing dead-link findings surfaced, none of them Track C's to fix. The user chose to
leave 8 of them as documented, pre-existing findings (see Track C's lessons file), but asked for this
one to be cut as its own small branch/PR before Track D starts, since it's a genuine one-line
correctness fix rather than judgment-call content.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
