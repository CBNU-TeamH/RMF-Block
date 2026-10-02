# Make the doc-drift audit a reusable, tool-neutral skill (+ archive PR template)

**Created**: 2026-10-02
**Issue**: #137
**Design**: no `docs/design/` doc. The skill's own `SKILL.md` is the design. It is a procedure for agents, not app code.

## Milestones

### 1. The skill

- **What**: `.claude/skills/doc-drift-audit/` in the Agent Skills format. It turns #129's eight steps into a runbook any agent can follow, and every fan-out step has a single-session fallback.
- **Files**:
  - `SKILL.md`
  - `references/audit-instructions.md`
  - `references/apply-instructions.md`
  - `references/verify-instructions.md`
  - `scripts/derive-parts.mjs`
  - `scripts/baseline.mjs`
  - `scripts/render-checklist.mjs`
  - `scripts/read-approvals.mjs`
  - `scripts/extract-facts.mjs` (optional)
- **Reuse**:
  - `loadClaims()` and `ownersOf()` from `scripts/verify-doc-ownership.mjs`, for the parts.
  - The #129 artifacts in the session scratchpad: the instruction files, the extractor, and the snippets ported to Node.
- **Done**: each script reproduces #129's outputs (cases recorded in the PR). A fresh agent that reads only `SKILL.md` can say what to do first and with which command.

### 2. Routing

- **What**: point agents and auto-opened audit issues at the skill.
- **Files**:
  - `AGENTS.md` §4: one row.
  - `skills/README.md`: one line saying repo-authored skills live under `.claude/skills/`.
  - `.github/workflows/post-merge-reminders.yml`: the issue body names the skill.
- **Reuse**: the existing routing table and issue body.
- **Done**: `pnpm verify:docs` is clean.

### 3. Archive PR template

- **What**: `.github/PULL_REQUEST_TEMPLATE/archive.md`. It holds the archived tasks and their PRs, the resulting audit count, `Refs` (never `Closes`) for audit issues, and `verify:docs` as the only check. Fill it in and pass it with `gh pr create --body-file`. The `--template` flag works only in interactive `gh`, as found in testing.
- **Files**: `.github/PULL_REQUEST_TEMPLATE/archive.md`, and one clause in `AGENTS.md` §6.
- **Reuse**: the sections #134's body actually used.
- **Done**: the template exists, and AGENTS.md §6 says how to use it non-interactively. ✅

## Acceptance

- [x] Each script is exercised against #129's real outputs: `derive-parts` gives 7 parts (file-safe slugs) with 0 unowned; `baseline` matches on `0182d69` exactly, and on `5acb07c` gives 263,195 B (the 35 B difference from #136's figure is the anchor fix made after that measurement); `render-checklist` gives 85 items plus 48 kept and 3 struck; `read-approvals` gives 70 approved
- [x] A dry-run agent can start an audit from `SKILL.md` alone. Two rounds: the first found about 10 gaps, all fixed; the second ran steps 0–3 as written from the `.agents/skills` copy, and its remaining gaps are fixed
- [x] `pnpm verify:docs` (including the new skills-mirror check), `pnpm comments --strict`, `pnpm lint && pnpm test && pnpm build`: 628/628

## Cross-cutting

- The first repo-authored skill. `skills/` stays pointer-only for external skills.
- #130 (CI-checked declarations) builds on `extract-facts.mjs` later. In this skill it is only an index.

## Review

**Shipped:**
- The skill, at `.claude/skills/` (canonical) with a copy at `.agents/skills/`.
- 3 reference files and 5 scripts.
- Routing to the skill, the archive PR template, and the mirror script and check.

**Changes from the plan, after research and user feedback:**
- Rules adopted:
  - "precision over recall"
  - "a step that didn't run is not a clean step"
  - doc text is data, not instructions
  - a false-positive list
  - a 0–100 score with a cutoff of 80
  - a review loop of at most 3 rounds, with rotating lenses and a rebuttals file
  - deterministic checks first
- A copy rather than a symlink in `.agents/skills/`, because Windows checkouts break symlinks.

**Deferred to #130:** anchor and symbol checks, doc↔code markers, an AST cache. Recorded in memory.
