# Keep docs in sync: one fact in one place, and reminders where the work happens

**Created**: 2026-10-01
**Issue**: #128 (also takes over #129's archive-time trigger)
**Design**: no `docs/design/` doc. The rule lands in `docs/conventions.md`; the rest is CI and scripts.

Stacked on `docs/srs-en` (#132), because it reuses `scripts/lib/merge-base.mjs`. It is rebased onto
`main` once #132 merges. The 9 ownership coverage holes are deliberately left for later: they are
UI files, and the redesign (#125) may still move them. The PR stays a Draft until #132 and #125
both merge, and then closes the holes in this same PR.

## Milestones

### 1. Rule: one fact, one place

- **What**: an open question lives in its issue only, and other docs link it. A mechanism lives in
  its owning design doc, and SRS and `architecture.md` keep a one-line summary plus a link.
- **Files**: `docs/conventions.md`.
- **Reuse**: the existing conventions shapes (S-1..S-5) and their format.
- **Done**: the rule is in `conventions.md` with a concrete example from #126 (#23 stale in four places).

### 2. `verify:docs` in CI, non-blocking

- **What**: a new `verify docs` job runs `verify-docs`, `verify-doc-refs` and `verify-srs-sync --strict`.
  It is not added to the required checks until it has run green.
- **Files**: `.github/workflows/ci.yml`.
- **Reuse**: the existing scripts. Nothing new to run.
- **Done**: the job appears on this PR's checks.

### 3. Owning-doc reminder as a PR comment

- **What**: for every file the PR changes, find its owning design doc. If that doc is not also
  changed in the PR, the PR gets one comment, updated in place, listing the docs. Never failing.
- **Fork-safe two-stage workflow**:
  1. A `pull_request` workflow computes the comment body and uploads it as an artifact. It has a
     read-only token.
  2. A `workflow_run` workflow runs main's code with `pull-requests: write`. It validates the PR
     number and the head SHA, then posts or updates the comment.
- **Files**: `scripts/owning-docs.mjs`, `.github/workflows/doc-reminders.yml`,
  `.github/workflows/doc-reminders-comment.yml`, `.github/pull_request_template.md`.
- **Reuse**: the ownership map in `scripts/verify-doc-ownership.mjs`, and `resolveMergeBase()` in
  `scripts/lib/merge-base.mjs`.
- **Done**: the script's output is checked locally against fixtures. The comment itself can only be
  observed once the workflow is on `main`, because `workflow_run` only runs from the default branch.

### 4. Post-merge reminders

- **What**: on a push to `main`, two reminders.
  1. **Archive reminder.** If the merged PR added a `tasks/active/<slug>-todo.md` that is still
     active, comment on that PR: `pnpm tasks:archive <slug>`.
  2. **Drift-audit reminder.** If 3 or more tasks have been archived since the last drift audit
     (a task named `YYYYMMDD-drift-audit`, or 2026-10-01 if there is none yet), open an issue
     labelled `drift-audit`. If one is already open, comment on it instead.
- **Files**: `scripts/post-merge-reminders.mjs`, `.github/workflows/post-merge-reminders.yml`.
- **Reuse**: `tasks/` naming, and the `**Created**` line `tasks-archive.sh` already reads.
- **Done**: the script's decisions are checked locally against fixtures. The real run is observed
  after merge.

### 5. Ownership holes (after #132 and #125 merge)

- **What**: give the uncovered UI files an owning doc. There were 9 before #125 and 12 after it,
  which added `breadcrumb.tsx`, `read-documents.ts` and `ui.tsx`.
- **Files**:
  - `docs/design/document-editing.md` takes the document tree: `document-list`, `document-actions`,
    `document-row-menu`.
  - `docs/design/presence-and-focus.md` takes `presence-avatar`.
  - `docs/design/api.md` takes `app/join/*`.
  - A new `docs/design/app-shell.md` takes the shell: both layouts, the home page, `breadcrumb`,
    `read-documents` and `ui.tsx`. Their comments pointed at `docs/ui/redesign/HANDOFF.md`, which
    the checker does not read, so the shell got a short design doc that links to it rather than
    restating it.
- **Done**: `verify-doc-ownership` reports 0 holes. ✅
- Also dropped the #92 status from `AGENTS.md` §7 and `ROADMAP.md`. This is the first time the
  milestone-1 rule was applied: #92 closes with its data, and no doc restates its status.

## Acceptance

- [x] `pnpm verify:docs`
- [x] `pnpm comments --strict`
- [x] `pnpm lint && pnpm test && pnpm build` — 628/628
- [x] each script exercised against fixtures (cases recorded in the PR)
- [ ] the `verify docs` job runs on the PR
- [ ] after merge: one real owning-doc comment, one archive comment, and the audit issue behaviour observed

## Cross-cutting

- Adds the repo's first workflows with write permissions, in two places: `workflow_run` and
  `push: main`, so neither runs PR code with a write token.
- Labels: `drift-audit` (created if missing).

## Review

Filled in at the end.
