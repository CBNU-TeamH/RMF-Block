# Drift audit: the parts that changed since 2026-10-02

**Created**: 2026-10-05
**Issue**: #151
**Design**: no new design doc. Runs `.claude/skills/doc-drift-audit/SKILL.md` against the existing ones.

The slug is exactly `YYYYMMDD-drift-audit`, so archiving this task resets the audit count in
`scripts/post-merge-reminders.mjs`.

## Milestones

### 1. Scope and baseline

- **What**: audit only the parts whose code changed since the full audit (#129, 2026-10-02):
  `document-editing` (the `/` menu and code surface, #149), `floating-and-history` (`CODE_SURFACE`
  reuse), and `harness` (the doc-check scripts, #138/#139). The other design docs had no code changes.
- **Done**: baseline posted on #151.

### 2. Audit and verify

- **What**: four read-only auditors (`document-editing` split at line 343), then one verifier for
  every A/F finding.
- **Done**: `audit/*.json` and `verify-AF.json` in the session scratchpad.

### 3. Triage and approval

- **What**: A/F decided here; B/C/D as a checklist on #151 for the user to tick.
- **Done**: approvals read back from the comment.

### 4. Apply, plus two lessons promotions

- **What**: approved edits, one commit per category. Also the two "Worth extracting" items from
  `tasks/archive/2026/10/20261005-slash-menu-query-lessons.md`, which the user asked to include:
  an IME-testing note in `docs/testing.md`, and the same-property-utility rule in `docs/conventions.md`.
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
