# Declare structural facts in docs and verify them against the AST (+ move skills/ into .claude/skills/)

**Created**: 2026-10-02
**Issue**: #130
**Design**: the declaration format is documented in `docs/conventions.md`, "Declared facts". The rest is CI scripts.

One PR with one commit per milestone. The main session owns the format and the first declarations; sub-agents implement independent scripts in separate worktrees, with no two touching the same file.

## Milestones

### M0. Move the root `skills/` directory into `.claude/skills/`

- **What**: `skills/README.md` and `skills/explain-diff.md` move to `.claude/skills/`, and every link to them is repointed.
- **Files**:
  - the moved files and their relative links;
  - `AGENTS.md`, `README.md`, `.github/pull_request_template.md`, `HARNESS-ARCHITECTURE.md`, `docs/conventions.md`;
  - the `docs/diagrams/harness/**` evidence paths;
  - `scripts/sync-skills.mjs`, which must mirror skill directories only, since a top-level file would fail `--check` forever.
- **Done**: no live link to the root `skills/` remains. `verify:docs` and `sync-skills --check` are clean.

### M1. Check `#anchors`

- **What**: `verify-docs` checks every `path#anchor` and same-file `#anchor` against the target's GitHub-style heading slugs.
- **Files**: `scripts/verify-docs.mjs`, `scripts/lib/headings.mjs`.
- **Reuse**: the existing link extraction in `verify-docs.mjs`. Today it drops the fragment.
- **Done**: the dangling anchor the baseline found fails the check and is then fixed. Every other anchor passes.

### M2. Check that cited SRS IDs exist

- **What**: every UC/FR/NFR/SIR/SOIR/HIR ID cited outside the SRS must be defined in `docs/SRS-ko.md`. Ranges such as `FR-090-01..13` are accepted.
- **Files**: `scripts/verify-srs-refs.mjs`, plus `scripts/verify-srs-sync.mjs` (an export only).
- **Reuse**: the ID-definition parsing in `verify-srs-sync.mjs`.
- **Done**: a fake `FR-999-01` fails. The baseline's real miss, `FR-022-05` in `editor.tsx`, is fixed.

### M3. Promote the AST extractor

- **What**: `scripts/lib/ast-facts.mjs` exports `extractFacts()`, and the skill's `extract-facts.mjs` becomes a thin wrapper around it.
- **Files**: `scripts/lib/ast-facts.mjs`, `.claude/skills/doc-drift-audit/scripts/extract-facts.mjs`, and the `.agents/skills` copy.
- **Reuse**: the existing extractor, including its bracket-safe glob, which is needed for `[id]` paths.
- **Done**: `facts.json` is identical before and after.

### M4. Declarations verified against the AST

- **What**: `<!-- declare: … -->` blocks with four predicates: `called-only-from`, `never-called`, `const` and `exists`. `scripts/verify-declarations.mjs` checks them. The first declarations go in `version-history.md`, `architecture.md` and `presence-and-focus.md`.
- **Files**: `scripts/verify-declarations.mjs`, `docs/conventions.md`, and the three design docs.
- **Reuse**: `extractFacts()` from M3.
- **Done**: every declaration passes on the current code, and fails when its code fact changes in a scratch copy.

### M5. Generated endpoint table

- **What**: a `<!-- generated:endpoints -->` block in `api.md` §1, rendered from the code's real routes, with `--check` failing when it is stale.
- **Files**: `scripts/gen-endpoints.mjs`, `docs/design/api.md`.
- **Reuse**: `extractFacts()`, and the `tasks-index.sh` freshness pattern.
- **Done**: adding a route without regenerating the block fails the check.

### Wiring

- **What**: `verify:docs` and CI's `verify docs` job run the new checks. The skill's "deterministic checks first" step names them.
- **Files**: `package.json`, `.github/workflows/ci.yml`, `.claude/skills/doc-drift-audit/SKILL.md` and its copy.

## Acceptance

- [x] Every negative case above fails, and the cases are recorded in the PR
- [x] `pnpm verify:docs` is clean with all of the new checks
- [x] `pnpm comments --strict`, `pnpm lint && pnpm test && pnpm build`
- [x] No live link to the root `skills/` remains

## Cross-cutting

- **Deferred:** an AST cache. A full parse takes about 0.9 s; revisit if CI parse time passes about 10 s.
- **Recommendation for the maintainer:** promote `verify docs` to a required check (a ruleset change).

## Review

### PR #139: skill mirror paths across operating systems

- **Scope**: fix review finding 1 in `scripts/sync-skills.mjs`.
- **Approach**: normalize `path.relative()` results to `/` using the native `path.sep`, matching `scripts/lib/ast-facts.mjs`. Keep the existing skill-folder filter and filesystem reads.
- **Success criteria**: Windows and POSIX paths (macOS/Linux) detect changed, missing and stale mirror files; matching mirrors pass; pointer files and destination-only skills remain excluded.
- **Verification**: temporary fixtures passed with native Linux paths, POSIX paths (macOS/Linux) and Windows `path.win32` paths. Checked matching, changed, missing and stale files, nested paths, spaces/non-ASCII characters, pointer exclusions and destination-only skills; simulated POSIX/Windows CLI checks returned 0 for matching mirrors and 1 for mismatches. The pre-fix Windows case reproduced the false clean result. Native macOS/Windows hosts were not available. `pnpm verify:docs`, `pnpm lint` and `git diff --check` passed.

### PR #139: reject unclosed declaration blocks

- **Scope**: fix review finding 2 in `scripts/verify-declarations.mjs`.
- **Approach**: collect declaration openings after stripping fenced examples, require each opening to close before the next declaration, then parse the existing multiline format. Report malformed or unclosed blocks at their opening line.
- **Success criteria**: missing or mistyped closers fail; a later valid block cannot supply an earlier block's closer; valid declarations and fenced examples retain their behavior, including CRLF input and diagnostic line numbers.
- **Verification**: temporary parser fixtures passed for missing/mistyped closers, broken blocks before/after valid blocks, multiple valid declarations, malformed single-line format, fenced examples, LF/CRLF and diagnostic line numbers. Existing predicate errors and quoted JSON values retained their behavior. The original `ink-limits` reproduction now reports `unclosed declaration block` at line 336; CLI returns 1 for malformed/unclosed inputs and 0 for a fenced example plus a valid declaration. `pnpm verify:docs`, `pnpm lint` and `git diff --check` passed.
