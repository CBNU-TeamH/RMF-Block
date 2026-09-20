# AGENTS.md doc-routing table: spell out tasks/active, tasks/archive — todo

**Created**: 2026-09-04
**Issue**: #65 (Phase 1, scope note — see `docs/design/architecture.md`-style cross-reference below)
**Design**: none — a one-line prose fix, not a design change.

## Milestones

### 1. Fix the dangling shorthand

- **What**: `AGENTS.md`'s doc-routing table (§4) links `tasks/` and, in the parenthetical after it,
  shorthand-quotes `active/` and `archive/`. Those two are bare shorthand that `scripts/verify-docs.mjs`'s
  dead-link checker resolves from the repo root (this project's own convention for backtick-quoted
  prose paths), where no such top-level directories exist. Spell them out as `tasks/active/` and
  `tasks/archive/` so the line is unambiguous to both a human reader and the checker.
- **Files**: `AGENTS.md`.
- **Reuse**: nothing to reuse — single-line prose edit.
- **Done**: `node scripts/verify-docs.mjs` shows two fewer dead-link findings than on `main`
  (9 → 7) — the `active/` and `archive/` shorthand each counted as its own finding.

## Acceptance

- [x] `AGENTS.md`'s doc-routing row reads `tasks/active/`, `tasks/archive/` instead of `active/`, `archive/`.
- [x] `node scripts/verify-docs.mjs` dead-link count drops from 9 to 7 (not 8 — both shorthand
      spans on that one line counted as separate findings), with this line's findings gone.
- [x] No other line in `AGENTS.md` changed.

## Cross-cutting

Found while running Track C's (`chore/verify-scripts`, PR #71) new `scripts/verify-docs.mjs` against
`main` — 9 pre-existing dead-link findings surfaced, none of them Track C's to fix. The user chose to
leave 8 of them as documented, pre-existing findings (see Track C's lessons file), but asked for this
one to be cut as its own small branch/PR before Track D starts, since it's a genuine one-line
correctness fix rather than judgment-call content.

## Review

Shipped exactly as planned: one line in `AGENTS.md` spelling out `tasks/active/` and
`tasks/archive/` instead of the bare `active/`/`archive/` shorthand. Verified by temporarily
borrowing `scripts/verify-docs.mjs` from the not-yet-merged `chore/verify-scripts` branch (this
branch doesn't have it yet, being cut from `main`) — dead-link count went from 9 to 7, not 9 to 8
as the plan assumed, because both shorthand spans on that one source line counted as separate
findings. Also caught and fixed a self-inflicted instance of the same bug Track C's lessons
already named: this task's own todo doc quoted the broken line using real markdown-link syntax
to describe it, which the checker read as an actual link and flagged. Rewrote it as plain prose
instead — twice now (this sentence is a second occurrence, worded to describe the trap without
writing the trap: any square-bracket-then-parenthesis span reads as a link candidate to
`extractMarkdownLinks`, backtick escaping or not).
