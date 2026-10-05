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

- [x] Every A finding fixed or kept with a reason; F and E filed or explained
- [x] Every ticked B/C/D item applied
- [x] Both lessons promotions applied
- [x] `pnpm verify:docs`, comment budget (pre-commit hook)
- [x] Before/after sizes in the PR

## Cross-cutting

- `docs/SRS-ko.md` / `SRS-en.md` are not edited (`AGENTS.md` §5); ADRs are not edited.

## Review

**Shipped.** 4 read-only auditors → 25 findings (A 9 · B 3 · C 4 · D 9 · E 0 · F 0). The A
verifier: 7 confirmed, 1 partial (harness-01, corrected fix used), 1 false (document-editing-a-06,
dropped). The user approved all 16 B/C/D items on #151; a-03 applied the ADR-preserving way. Three
editors in separate worktrees, integrated as one commit per category plus the stale-comment
commit (`ponytail:` → `simple:` ×2, the `touchesBlockList` pointer). Both lessons promotions landed
(`docs/testing.md` IME paragraph, `docs/conventions.md` base-`className` rule).

**Review loop.** Round 1 (nothing lost): one blocking — a-04's edit deferred the rebuild-by-copy
measurement to ADR-007, which does not carry it; restored, with the 0.7.13 and Playwright
qualifiers. Round 2 (edits are true): nothing blocking; two minor fixes applied.

**Sizes** (audited docs): 120,672 → 120,816 B, 1,915 → 1,928 lines — flat, because the B additions
and the two promotions offset the D deletions. History-narration markers 4 → 3.

**Not done:** ADR edits (ADR-007:23 still says `moveBefore`; ADR-008's examples), by the
ADRs-keep-history default. testing.md:76's "props can be checked directly" (minor, pre-existing).
