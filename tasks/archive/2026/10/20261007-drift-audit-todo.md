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

- [x] Every A finding fixed or kept with a reason; F and E filed or explained
- [x] Every ticked B/C/D item applied
- [x] Both lessons promotions applied
- [x] `pnpm verify:docs`, comment budget (pre-commit hook)
- [x] Before/after sizes in the PR

## Cross-cutting

- `docs/SRS-ko.md` / `SRS-en.md` are not edited (`AGENTS.md` §5); ADRs are not edited.

## Review

**Shipped.** 4 read-only auditors (Sonnet) → 8 findings (A 4 · B 1 · C 2 · D 0 · E 0 · F 1);
testing found nothing. The A/F verifier: 4 confirmed, 1 partial (chat-floating-02 — the ✅ it
read as "done" is the "survives under version B" column; corrected fix used), 0 false. All five
A/F applied; the F was a stale comment, moved rather than filed. The user approved the
recommendation on #158: document-editing-02 and chat-floating-03 applied, document-editing-01
left (its fix edited ADR-008). Both lessons promotions landed (`docs/conventions.md` future-path
rule, `.claude/skills/README.md` report-only parallel passes).

**Applied in the main checkout, not in worktrees** — seven short edits in seven files, so the
fan-out would have cost more than it isolated. One commit per category, then the fixups.

**Review loop.** Round 1 (nothing lost): one blocking — `lib/files/types.ts` still said
FR-061-01 filters on `FileOrigin`, a second copy of the claim fixed in `api.md`. Round 2 (edits
are true): one blocking — the new skills-README paragraph claimed a sub-agent's model setting
overrides inheritance, contradicting the section above it and never measured; cut to the
report-only rule. Round 3 (rest of the diff): nothing blocking; minors applied (the paragraph
moved beside the order it qualifies, rewraps, a link citation).

**Numbers.** 148,502 → 149,030 bytes (+528), 2,161 → 2,169 lines: the B sentence and the two
promoted sections outweigh the cuts. `chat.md` ↔ `floating-view.md` shared runs 7 → 0.
