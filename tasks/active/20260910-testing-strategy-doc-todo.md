# Testing strategy doc (issue #66, track C2)

**Created**: 2026-09-10
**Issue**: #66 (this task covers track C2 only — the strategy doc, not test-writing itself)
**Design**: no separate design doc — the deliverable *is* `docs/testing.md`.

## Milestones

### 1. Write `docs/testing.md`

- **What**: the four layers a test can belong to, the question each answers, and the tool/pattern
  for each; the regression/boundary rule that answers #66's "selection hole"; a Vitest
  worker-count symptom→remedy note.
- **Files**: `docs/testing.md` (new).
- **Reuse**: follows the `Status`/`Owns`/`Related` header convention already shared by
  `docs/design/*.md` (`architecture.md`'s "Owns: none, with justification" is the precedent for a
  doc that isn't a per-module design doc). Points at #66 for the measured line-count breakdown
  rather than re-deriving it, since that will drift.
- **Done**: every one of #66's three C2 bullets, plus the route-handler addition below, is
  traceable to a specific section of the doc.

### 2. Route handlers — scoped beyond #66's literal C2 text

- **What**: #66's C2 checklist names three things and doesn't mention route handlers, but #66's
  own four-layer table lists them as a zero-tests layer with no C4 sub-track claiming them either.
  Decided with the user to give this layer a real, concrete rule rather than leave it as an
  unscoped gap, grounded in `app/api/documents/route.ts`: an inlined auth check no `lib/` test can
  see if it regresses, and an already-fixed, currently-unguarded malformed-body bug named in that
  file's own comment — the same "selection hole" shape #56/#57 already established.
- **Files**: `docs/testing.md` (same file as milestone 1).
- **Reuse**: route handlers are plain exported async functions, callable directly with a
  constructed `Request` — no DOM, `environment: "node"`, the same cost as a `lib/` test.
- **Done**: the doc states the required minimum per handler (unauthenticated request rejected
  before data access; invalid body maps to 400) without re-scoping business-logic testing that
  already belongs to `lib/`.

### 3. Wire the doc in

- **What**: `AGENTS.md` §4's doc-routing table row for "Test strategy" currently says "Doesn't
  exist yet — arrives with Phase 2 (#66)'s Vitest migration" — stale on two counts (the migration
  landed via #87; the doc, not the migration, was the missing thing). Point it at the new file.
- **Files**: `AGENTS.md`.
- **Reuse**: n/a — one-line fix.
- **Done**: the row links to `docs/testing.md`.

## Acceptance

- [ ] `docs/testing.md` exists, matches the design-doc header convention, covers all four layers
      including route handlers.
- [ ] `AGENTS.md` §4's stale "Test strategy" row fixed.
- [ ] `pnpm verify:docs` clean.
- [ ] `pnpm lint` / `pnpm test` / `pnpm build` clean.
- [ ] Comment posted on #66 summarizing what shipped — issue body/checkboxes left for the
      user/team to edit themselves, not edited directly (same convention already used for #65).

## Cross-cutting

Docs-only — no code, no SRS requirement of its own. Unblocks nothing mechanically (no CI check
reads this file), but it's the thing #66's own C2 checklist and `AGENTS.md` §4 have been pointing
at since before either existed.

## Review

<!-- filled in at the end -->
