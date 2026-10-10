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
- Commands and observed results (fill in before the PR): `pnpm verify:docs` clean on the base (`6399f0e`) and on every integrated commit; the pre-commit comment budget clean on every commit; the pre-push `pnpm test` + `pnpm build` run on push. The F commit only edits four comments, so no test layer changes.

## Acceptance

- [x] Every A finding fixed or kept with a reason; F and E filed or explained
- [x] Every ticked B/C/D item applied
- [x] `pnpm verify:docs`, comment budget (pre-commit hook)
- [x] Before/after sizes in the PR
- [x] Notion WBS rows synced

## Cross-cutting

- `docs/SRS-ko.md` / `SRS-en.md` are not edited (`AGENTS.md` §5); ADRs are not edited.
- A change to README.md goes into README.ko.md in the same commit (`AGENTS.md` §5).

## Review

**Shipped.** A full audit: 8 read-only auditors (Sonnet) → 46 findings (A 14 · B 4 · C 13 · D 13 ·
E 0 · F 2); the A/F verifier confirmed 10, dropped 6. A Codex independent re-review on #184 added
A01–A10, B01–B03 and F01–F03 and narrowed a few verdicts; the user decided in chat: apply every
recommendation, Codex wins where the two disagree. A second verifier confirmed all 13 Codex A/B
items. Applied: 19 A, 8 B, 10 C, 12 D (counting the AGENTS.md §7 spread and one ARCHITECTURE.md
write-queue line found while packaging), plus four stale code comments (F).

**Not applied.** workflow-01 (the native-dev Yorkie addresses stay explicit in CONTRIBUTING.md, per
the #159 review), workflow-02 (README stays self-contained), presence-and-focus-09 and
chat-floating-02 (Codex: the figure and the reason are worth keeping), api-02 and api-04 (Codex: not
contradictions), and the six the A/F verifier dropped. The FR-030-08 pause/resume qualifier removed
with api.md §4.2 was not restored — no pause/resume is built.

**Moved to issues.** Codex F01–F03 are code bugs, not doc drift: #185 (restore takes two undos,
v0.0.7), #186 (an open document link misses rename/delete/restore, v0.0.5), #187 (a deleted
document's floating view after reload, v0.0.4).

**How.** Five editors (Sonnet) in worktrees outside the repo, disjoint file sets, one commit per
category; integrated with `cherry-pick -n` into one commit per category (A, B, C, D, F). Review:
round 1 (nothing lost) and round 2 (edits true) found nothing blocking; round 3 (rest of the diff)
found one — a D trim deleted the registry measurement — fixed in the fixup commit with two minors.

**Notion.** `상태` → 완료 on 8.1, 14.7, 15.0, 18.1, 20.1, 20.2; new row 19.4 for #168 (comment on
#168).

**Numbers** (audited parts, `6399f0e` → final): 313,576 → 311,905 bytes, 4,563 → 4,536 lines; the B
additions offset most of the C/D cuts. ROADMAP.md, ARCHITECTURE.md and the perf doc are outside the
measured parts (±4 lines).
