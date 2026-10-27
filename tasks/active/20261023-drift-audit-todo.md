# Drift audit: the design docs against the code since #184

**Created**: 2026-10-23
**Issue**: #228
**Design**: [`.claude/skills/doc-drift-audit/SKILL.md`](../../.claude/skills/doc-drift-audit/SKILL.md) — the procedure; this task is one run of it

## Milestones

### 1. Scope and baseline

- **What**: a full audit, on base `f81a3f6`. Since the last one (#184, `6399f0e`), 26 commits changed code under most design docs:
  - the file manager (#219);
  - the follow pause (#220, #223);
  - chat links (#225);
  - the floating window gaps (#232) and #187 (#235);
  - packaging and the perf harness (#191–#215);
  - CI (#230).

  Six measured parts:
  - editing (`document-editing.md` with ADR-007/008);
  - presence (`presence-and-focus.md` with ADR-001);
  - chat-floating (`chat.md`, `floating-view.md`, ADR-006);
  - api (`api.md`, `architecture.md`, `ARCHITECTURE.md`, ADR-002/005);
  - shell-files-history (`app-shell.md`, `file-manager.md`, `version-history.md`);
  - workflow (README.md/README.ko.md, CONTRIBUTING.md, AGENTS.md, `docs/testing.md`, ADR-003/004/009).

  `document-editing.md` (739 lines) and `presence-and-focus.md` (655) are each split between two auditors at a section boundary, so there are eight auditors. SRS files get category E only.
- **Reuse**: the skill's scripts and references, unchanged.
- **Done**: `pnpm verify:docs` clean on the base; baseline posted on #228.

### 2. Audit and verify

- **What**: one read-only auditor sub-agent (Sonnet) per part, then one verifier for every A/F finding.
- **Done**: `audit/*.json` and `verify-AF.json` in the session scratchpad.

### 3. Triage and approval

- **What**: A/F decided here; E filed as one issue; B/C/D as a checklist on #228 for the maintainer to tick.
- **Done**: approvals read back from the comment.

### 4. Apply, integrate, review

- **What**: approved edits in worktrees outside the repo, disjoint file sets, one commit per category, handoffs after. Then up to three verifier rounds: nothing lost, then the edits are true, then the rest of the diff.
- **Done**: a round with no blocking finding; after-numbers on the final commit.

## Test selection

- Vitest (logic / component / server / route): no change expected — documentation only. A stale code comment fixed under F is checked by `pnpm lint` and `pnpm test`.
- Browser E2E (`e2e/`): no change — documentation only.
- Container smoke (`.github/workflows/ci.yml`): no change.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] Every approved A/B/C/D/F item is applied, or the PR says why not.
- [ ] `pnpm verify:docs` and `pnpm comments` pass; a review round finds nothing blocking.
- [ ] The audit task is archived in the audit PR, so merging resets the count.

## Cross-cutting

Closes #228. Code bugs the audit finds are filed as issues, not fixed here. Requirements drift, if any, becomes one issue for the team.

## Review

Filled in at the end.
