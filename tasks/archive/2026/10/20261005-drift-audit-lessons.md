# Drift audit (2026-10-05) — lessons

**Created**: 2026-10-05

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- A C fix that shrinks a copy to "see the ADR" is only safe if the ADR actually carries the fact. a-04 deferred the rebuild-by-copy measurement to ADR-007, which only has the re-parent one — the round-1 verifier caught it by grepping for the fact, not the link.
- `verify-declarations.mjs` cannot run in a worktree without `node_modules` (it loads `typescript`); editors reported it as a crash. It has to run in the main checkout after integration.

## What we would do differently

- Scope the audit from `git diff --stat <last audit>..HEAD` from the start: three days after a full audit, three parts were enough, and the run produced 25 findings instead of 136.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- `doc-drift-audit`'s audit instructions, category C: before proposing "shrink the copy to a link", check the owner carries the fact *with its qualifiers* (version, measured value) — quote the owner's line in `evidence`.
