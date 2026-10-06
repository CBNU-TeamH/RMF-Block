# Drift audit: the parts that changed since 2026-10-05

**Created**: 2026-10-07
**Issue**: #158
**Design**: no new design doc. Runs `.claude/skills/doc-drift-audit/SKILL.md` against the existing ones.

The slug is exactly `YYYYMMDD-drift-audit`, so archiving this task resets the audit count in
`scripts/post-merge-reminders.mjs`.

## Milestones

### 1. Scope and baseline

- **What**: audit only the parts whose code changed since the last audit (#151, `710d734`):
  `chat-floating` (#156: `chat.md`, `floating-view.md`), `document-editing` (#153's IME race —
  the editing-surface sections, lines 260–435), `testing` (#153/#155: `docs/testing.md`, the
  performance criteria doc, `e2e/`) and `workflow` (#153: `AGENTS.md`, `HARNESS-ARCHITECTURE.md`,
  the PR template, `.claude/skills/README.md`, `ci.yml`). Other design docs had no code changes.
- **Done**: baseline posted on #158.

### 2. Audit and verify

- **What**: four read-only auditors (Sonnet sub-agents), then one verifier for every A/F finding.
- **Done**: `audit/*.json` and `verify-AF.json` in the session scratchpad.

### 3. Triage and approval

- **What**: A/F decided here; B/C/D as a checklist on #158 for the user to tick.
- **Done**: approvals read back from the comment.

### 4. Apply, plus two lessons promotions

- **What**: approved edits, one commit per category. Also the two deferred "Worth extracting"
  items the user asked to include:
  `docs/conventions.md` — a not-yet-built path in backticks drops its trailing slash
  (`20261006-perf-criteria-scope-lessons.md`); `.claude/skills/README.md` — review passes run as
  parallel sub-agents are report-only (`20261006-chat-media-floating-lessons.md`).
- **Done**: `pnpm verify:docs` clean; after-numbers on the final commit.

## Acceptance

- [ ] Every A finding fixed or kept with a reason; F and E filed or explained
- [ ] Every ticked B/C/D item applied
- [ ] Both lessons promotions applied
- [ ] `pnpm verify:docs`, comment budget (pre-commit hook)
- [ ] Before/after sizes in the PR

## Cross-cutting

- `docs/SRS-ko.md` / `SRS-en.md` are not edited (`AGENTS.md` §5); ADRs are not edited.

## Review

Filled in at the end.
