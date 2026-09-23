# Promote comment-budget to a required CI check

**Created**: 2026-09-23
**Issue**: #92 (the promotion half only — its three review-quality criteria stay open there)
**Design**: none — the policy lives in `docs/conventions.md` ("The comment budget is a ratio"),
which this task updates in place.

## Milestones

### 1. The script becomes a ratcheting gate

- **What**: `--strict` fails only a file this change pushed over 30% *and* whose comment lines
  grew; a file already over on the merge base is reported but passes. Under `--strict`, a missing
  merge base is a failure rather than a skip.
- **Files**: `scripts/comment-budget.mjs`.
- **Reuse**: the 30%-plus-ratchet patch trialled on `feat/version-history` (#117), where it caught
  three real regressions and no false positive. `ratioFromSource` and `resolveMergeBase` unchanged.
- **Done**: in a scratch worktree off `upstream/main` — a commit adding comments to a `.ts` file
  already over budget exits 1; a commit deleting only code from one exits 0; a new file over
  budget exits 1; a `--depth 1` clone exits 1 with the no-merge-base message (0 without
  `--strict`). No `fatal:` line on stderr for a new file. **Measured, all five as stated** —
  `lib/presence/occupancy.ts` 37.6% → 39.1% failed, → 38.1% by deleting code passed.

### 2. CI runs it

- **What**: a separate `comment budget` job in `ci.yml` runs `node scripts/comment-budget.mjs
  --strict` with `fetch-depth: 0`. No pnpm install — the script is stdlib only.
- **Files**: `.github/workflows/ci.yml`.
- **Reuse**: the existing jobs' `checkout` (`persist-credentials: false`) and `setup-node@v4`
  (Node 24) steps.
- **Done**: this PR's `comment budget` log reads `clean against <sha>`, not `No merge base found`.

### 3. The promotion reminder goes away

- **What**: its job is done once the gate exists.
- **Files**: `scripts/lib/promotion-date.mjs` (deleted), `scripts/verify-docs.mjs` (import, call,
  header item (d)).
- **Reuse**: nothing.
- **Done**: `pnpm verify:docs` clean with no promotion line; `grep -r promotion-date scripts` empty.

### 4. Docs say what the gate does

- **What**: 30%, not 25%; CI blocks what a PR made worse and reports what it inherited; the way out
  of a failure is moving rationale to `docs/`.
- **Files**: `docs/conventions.md` (the comment-budget section), `AGENTS.md` §6 (required checks)
  and §7 (the item becomes "track #92's three criteria", not deleted).
- **Reuse**: the rationale already in the script's `THRESHOLD` / `SMALL_FILE_FLOOR` comments —
  pointed to, not copied.
- **Done**: `pnpm verify:docs` clean.

## Acceptance

- [x] `pnpm lint`, `pnpm test`, `pnpm build` pass.
- [x] `pnpm verify:docs` clean.
- [x] `pnpm comments --strict` passes on this branch.
- [x] Milestone 1's four negative cases behave as stated.
- [x] `comment budget` job green on the PR and its log shows a resolved merge base (`clean against 613876f`).

## Cross-cutting

- After merge, `comment budget` must be added to ruleset 20220373's required checks — until then
  a red run does not block merging. Owner action, confirmed with the user first.
- Out of scope: the six files already over 30% on `upstream/main` (`lib/focus/ink.ts` 47.2%,
  `lib/presence/occupancy.ts`, `lib/files/upload.ts`, `ink-overlay.tsx`, `lib/documents/tree.ts`,
  `use-block-document.ts` 30.9%) — the ratchet passes them; tidying them is its own PR.
- Out of scope: `docs/diagrams/harness/**` — pinned to revision `d317ae1` and already missing the
  `yorkie invariants` job; regenerating it is its own pass.

## Review

Filled in at the end.
