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
  - `pnpm verify:docs` (all seven checks) and `pnpm comments`: clean after each category commit.
  - `docker compose config` still parses `docker-compose.yml`, where only comments changed. It stops only at the missing `.env` values, as it does on `main`.
  - Before/after (`baseline.mjs` over the six parts):
    - `f81a3f6` reproduces the audit's baseline exactly: 24 files, 336,179 bytes, 4,776 lines.
    - `main` at `196eca9`, before this PR: 336,942 bytes, 4,783 lines.
    - This PR: 335,970 bytes, 4,787 lines. That is −972 bytes; B added content, and C and D removed some.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] Every approved A/B/C/D/F item is applied, or the PR says why not.
- [x] `pnpm verify:docs` and `pnpm comments` pass; a review round finds nothing blocking.
- [x] The audit task is archived in the audit PR, so merging resets the count.

## Cross-cutting

Closes #228. Code bugs the audit finds are filed as issues, not fixed here. Requirements drift, if any, becomes one issue for the team.

## Review

**Who did what.** `ujin999` ran steps 1–5 on 2026-10-23: the baseline, eight auditors, A/F verification and the checklist on #228. `TaeTaeJin` took over steps 6–8 on 2026-10-27 in one Claude Code session.

**Approved.** The coordinator's recommendation (ticks and the decision note are on the #228 checklist):
- Applied: all 11 verified A items and 33 B/C/D items. presence-a-04 and shell-files-history-04 were one edit.
- Not applied:
  - api-09, editing-a-02 and editing-a-06 edit an ADR, and ADRs keep their history.
  - workflow-03, workflow-04 and workflow-05 would undo what #184 kept: the native-dev Yorkie addresses in CONTRIBUTING.md, and a self-contained README.
  - editing-b-02: #242 made it untrue, because `block-link` now has a creator.

**Re-checked against `main`.** Five commits landed after the base (#242–#246). Every item was re-read against the current file before it was applied.
- One more stale line was fixed with D: "the future 블록 링크 블록" in `document-editing.md`.
- #242 had already removed chat.md's open question about pasting a block address.

**Review.** Three single-session rounds:
1. Nothing lost. Every moved fact is present at its owner:
   - ADR-009 Decisions 3 and 5 for the release steps;
   - AGENTS.md §6 for what blocks a merge;
   - `presence-and-focus.md` for `router.refresh()`;
   - ADR-006 for the hub-broadcast reason;
   - `app-shell.md` for the 파일 link and the rail.
2. The edits are true. The A/B items were checked against `ci.yml` and `workspace-config.ts`, `yorkie-admin.ts`, `ink-overlay.tsx`, `document-list.tsx`, `app/admin/page.tsx` and `editor.tsx`.
3. The rest of the diff. One fix: "settled there" in `architecture.md` now names its doc.

No round found anything blocking.

**Other.** The edits were made in one session with no editor sub-agents. There were about 45 edits, mostly in disjoint files, which one pass handled. No E (requirements) or F (code) findings.
