# Drift audit: every design doc, after admin, tabs, the .data/ layer and packaging

**Created**: 2026-10-10
**Issue**: #184
**Design**: no new design doc. Runs `.claude/skills/doc-drift-audit/SKILL.md` against the existing ones.

The slug is exactly `YYYYMMDD-drift-audit`, so archiving this task resets the audit count in
`scripts/post-merge-reminders.mjs`.

## Milestones

### 1. Scope and baseline

- **What**: a full audit — since the last one (#159, `a8544c8`) code changed under almost every
  design doc: admin and auth (#170), location tracking (#167), the `.data/` layer and soft delete
  (#175), tabs (#178), E2E coverage (#171) and packaging (#181, #182). About eight parts, from
  `derive-parts.mjs` grouped by topic; `document-editing.md` (692 lines) split between two
  auditors; README.md/README.ko.md, CONTRIBUTING.md, AGENTS.md and ADR-009's topic in a workflow
  part. SRS files get category E only.
- **Reuse**: the skill's scripts and references, unchanged.
- **Done**: `pnpm verify:docs` clean on the base; baseline posted on #184.

### 2. Audit and verify

- **What**: one read-only auditor sub-agent per part, then one verifier for every A/F finding.
- **Done**: `audit/*.json` and `verify-AF.json` in the session scratchpad.

### 3. Triage and approval

- **What**: A/F decided here; E filed as one issue; B/C/D as a checklist on #184 for the user to tick.
- **Done**: approvals read back from the comment.

### 4. Apply, integrate, review

- **What**: approved edits, one commit per category, handoffs after; then up to three verifier
  rounds (nothing lost → edits true → rest of the diff).
- **Done**: a round with no blocking finding; after-numbers on the final commit.

### 5. Notion WBS

- **What**: `상태` → 완료 on 8.1 (#142), 14.7 (#48), 15.0 (#114), 18.1 (#106), 20.1 (#160),
  20.2 (#161); a new row for #168 with a `WBS x.y` comment on the issue. Parent rows stay with the user.
- **Done**: the data source re-queried shows them.

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior.

- Vitest (logic / component / server / route): none — docs only, unless an F turns out to be a stale code comment (comment-only edits change no behaviour).
- Browser E2E (`e2e/`): none — no behaviour changes.
- Container smoke (`.github/workflows/ci.yml`): none — no behaviour changes.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] Every A finding fixed or kept with a reason; F and E filed or explained
- [ ] Every ticked B/C/D item applied
- [ ] `pnpm verify:docs`, comment budget (pre-commit hook)
- [ ] Before/after sizes in the PR
- [ ] Notion WBS rows synced

## Cross-cutting

- `docs/SRS-ko.md` / `SRS-en.md` are not edited (`AGENTS.md` §5); ADRs are not edited.
- A change to README.md goes into README.ko.md in the same commit (`AGENTS.md` §5).

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
