# Drift audit: the design docs against the code since #228

**Created**: 2026-11-26
**Issue**: #260
**Design**: [`.claude/skills/doc-drift-audit/SKILL.md`](../../.claude/skills/doc-drift-audit/SKILL.md) — the procedure; this task is one run of it

## Milestones

### 1. Scope and baseline

- **What**: an audit scoped to what changed, on base `61a2461`. Since the last one (#228, applied in `72e08f2`), 27 non-archive commits changed 101 code files (+5,607 / −335):
  - block selection, copy as Markdown, Markdown paste and import (#263, #264, #266, #272);
  - several blocks in one floating view (#274);
  - document export (#295, a new `document-export.md`);
  - one-update restore (#292), the focused-block republish (#293), the Yorkie 0.7.28 bump and its sync-loop patch (#261, #275);
  - demo hotfixes (#287), 미리보기 불가 (#283);
  - E2E growth: lifecycle, host admin, cross-browser, system tests (#252–#256, #277, #282), and the perf harness pins.

  Seven parts, ordered by how much their code changed:
  - editing-a: `document-editing.md` lines 1–406 (to "Editing surface") with ADR-007/008;
  - editing-b: `document-editing.md` lines 407–848 (registry to the end);
  - export-history: `document-export.md`, `version-history.md`;
  - floating-chat: `floating-view.md`, `chat.md`, ADR-006;
  - api: `api.md`, `architecture.md`, ADR-002/005;
  - shell-files: `app-shell.md`, `file-manager.md`;
  - workflow-testing: `docs/testing.md`, README.md/README.ko.md, CONTRIBUTING.md, AGENTS.md, ADR-003/004/009.

  Left out: `presence-and-focus.md` and ADR-001, because only 3 lines of its code changed (#293's republish is checked from editing-b, which owns the editor effect). SRS files get category E only.
- **Mode**: the coordinator audits the parts in this session, with no auditor or editor sub-agents. Each part's findings go to its own file before the next part starts. The A/F verification (step 5) is one verifier sub-agent, so the context that wrote the findings is not the one that judges them.
- **Reuse**: the skill's scripts and references, unchanged.
- **Done**: `pnpm verify:docs` clean on the base; baseline posted on #260.

### 2. Audit and verify

- **What**: the seven parts audited read-only, one after another, then one verify pass over every A/F finding.
- **Carried in**: the yorkie-0728 lessons' "Worth extracting" item (a green "no longer reproduces" needs a control run that does reproduce it with the same script). It is weighed here as a B candidate for `docs/testing.md`; #296 left it unpromoted.
- **Done**: every A/F finding verified.

### 3. Triage and approval

- **What**: A/F decided here. E is filed as one issue. B/C/D go on #260 as a checklist for the maintainer to tick.
- **Done**: approvals read back from the comment.

### 4. Apply, integrate, review

- **What**: approved edits, one commit per category, handoffs after. The edits go in the main checkout because there are no editor sub-agents, so no worktrees are needed. Then up to three review rounds: nothing lost, then the edits are true, then the rest of the diff.
- **Done**: a round with no blocking finding; after-numbers on the final commit.

## Test selection

- Vitest (logic / component / server / route): no change expected, since this is documentation only. A stale code comment fixed under F is checked by `pnpm lint` and `pnpm test`.
- Browser E2E (`e2e/`): no change, since this is documentation only.
- Container smoke (`.github/workflows/ci.yml`): no change.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] Every approved A/B/C/D/F item is applied, or the PR says why not.
- [ ] `pnpm verify:docs` and `pnpm comments` pass; a review round finds nothing blocking.
- [ ] The audit task is archived in the audit PR, so merging resets the count.

## Cross-cutting

Closes #260. Code bugs the audit finds are filed as issues, not fixed here. Requirements drift, if any, becomes one issue for the team.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
