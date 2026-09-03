# `docs/conventions.md` — the rulebook `code-review` is already reading for

**Created**: 2026-09-04
**Issue**: #65 (Phase 1, track A, of #67)
**Design**: this task's own deliverable *is* the design doc — there is nothing upstream of it
to design against. Full derivation: the harness review linked from #67.

## Milestones

### 1. Five forbidden shapes

- **What**: `docs/conventions.md`, a new file. Its body is five patterns — not a style guide,
  a list of ways code can behave correctly and still be shaped wrong, since no test can catch
  that difference (`#40`'s own text: the seven persistence tests "should pass unmodified" after
  the fix). Each shape gets the forbidden pattern, what to do instead, a detection signal, and a
  citation with the issue's **current** state noted (`#59` is closed/fixed; `#40`, `#52`, `#56`,
  `#57` are open at the time of writing — re-check before merge).
  - S-1 mutate-then-rollback → compute, write, commit after success. `#40`.
  - S-2 two owners for one piece of state → name one owner. `#59` (closed), `#52` (open).
  - S-3 swallow-error-substitute-default → handle known failures, throw the rest. No open
    issue — cites the `lib/chat/chat-service.ts` lessons in `tasks/archive/2026/08/`.
  - S-4 hardcode-a-limit-without-checking-spec → cite the clause, test the boundary. `#56`,
    `#57`.
  - S-5 ignore-an-existing-precedent → route through it or say why not. `#59` (closed).
- **Files**: `docs/conventions.md`.
- **Reuse**: the `**Status**` / `**Related**` header convention already in every
  `docs/design/*.md` file — this doc isn't a design doc (it has no `**Owns**`, that's track C's
  convention for design docs specifically), but the header shape is worth matching for
  consistency.
- **Done**: the five shapes are derivable from the repo's own issue history, not invented — each
  citation actually supports the pattern it's attached to.

### 2. What stays inline, and why

- **What**: the test for whether a comment survives — *"could a reader derive this from the
  code?"* — plus the three kinds that pass it: an external constraint the code can't express, a
  one-line requirement tag (`FR-020-06/07`), a deliberate-simplicity marker. And the marker's
  name: `simple:` (track B does the actual repo-wide rename from `ponytail:`; this doc is where
  the convention is defined).
- **Files**: `docs/conventions.md`.
- **Reuse**: none — this is the first place either rule is written down.
- **Done**: the three kinds are each backed by a real example already in the codebase, not a
  hypothetical.

### 3. The Node type-stripping constraint, consolidated

- **What**: one canonical statement of why `.ts`-suffixed imports matter, replacing two
  independent (and one wrong) explanations. `tsconfig.json:14-17` currently blames the *test*
  runner; the real reason is production — `server/index.mts` runs directly under `node`
  (`Dockerfile`'s `CMD ["node", "server/index.mts"]`; `package.json`'s `dev`/`start` scripts do
  the same) and imports `lib/auth/session-cookie.ts` with the extension. `node --test` hits the
  identical constraint for the same reason — it is not the cause. `lib/chat/chat-service.ts:19-22`
  has a second, correct-but-duplicated explanation.
- **Files**: `docs/conventions.md` (the statement lives here). `tsconfig.json` and
  `lib/chat/chat-service.ts` get repointed at it in track B, not this task — this task only needs
  the statement to exist and be stable enough to link to.
- **Reuse**: `lib/chat/chat-service.ts:19-22`'s existing explanation is correct and becomes the
  base text; `tsconfig.json:14-17`'s is wrong and is not reused.
- **Done**: one paragraph, no longer duplicated once track B lands.

### 4. Tailwind arbitrary-class rule

- **What**: before trusting a first-time-in-project Tailwind class, grep the compiled
  `.next/dev/static/chunks/*.css` for the literal class name. From `20260829-block-editor-lessons.md`
  — three separate silent failures in one milestone had this exact shape and fix.
- **Files**: `docs/conventions.md`.
- **Reuse**: the lessons entry itself; nothing invented.
- **Done**: rule stated with the concrete failure mode (class silently doesn't compile, no error)
  that makes it non-obvious why this is needed.

## Acceptance

- [ ] `docs/conventions.md` exists with all five shapes, the three-comment-kinds rule, the
      `simple:` convention, the consolidated type-stripping statement, and the Tailwind rule.
- [ ] Every issue citation resolves via `gh issue view <n>` and its open/closed state in the doc
      matches reality at merge time.
- [ ] `bash scripts/tasks-index.sh` is idempotent.

## Cross-cutting

- **Track B depends on this for one line** — `tsconfig.json`'s reworded comment wants to point
  at this doc's exact heading. Land this content (doesn't need to be merged yet) before track B
  finishes that edit.
- **Track C's `comment-budget.mjs` routes toward this doc** — "move this to docs/" only means
  something once the doc exists to move things to.
- **`AGENTS.md` §3/§4** currently route to a `docs/conventions.md` that doesn't exist; track D
  fixes the routing once this lands. Not this task's job to edit `AGENTS.md`.
- No SRS requirement covers this; nothing in `docs/SRS-ko.md` changes.

## Review

Filled in at the end.
