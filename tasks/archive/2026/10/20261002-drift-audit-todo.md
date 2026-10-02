# Drift audit: doc-code drift and doc compression

**Created**: 2026-10-02
**Issue**: #129, #135 (the audit reminder #133's workflow opened)
**Design**: no new design doc. This task edits the existing ones.

The slug is exactly `YYYYMMDD-drift-audit`, so archiving this task resets the audit count in
`scripts/post-merge-reminders.mjs`.

## Milestones

### 1. Extract structural facts

- **What**: a one-off AST extractor, built on the `typescript` compiler API. It traces client
  `fetch`/`WebSocket` calls → `app/api/**/route.ts` methods → `@/lib` imports → Yorkie calls, plus
  the WS paths in `server/index.mts`. The output is JSON sliced per audit part.
- **Files**: none committed. The extractor lives in the session scratchpad; promoting it is #130.
- **Done**: the JSON covers every route file and every client call site, or lists the ones it
  could not resolve.

### 2. Audit (7 read-only sub-agents, one per part)

- **What**: each finding carries an id, a category, `doc:line`, the claim, code evidence
  (`file:line`) and a proposed fix.
- **Categories**:
  - **A**: code contradicts the doc.
  - **B**: behaviour the doc misses.
  - **C**: a fact duplicated in another doc.
  - **D**: history narration.
  - **E**: SRS drift.
  - **F**: the code is wrong.
- **Done**: every part reports findings and its sizes.

### 3. Triage and approval

- **What**: the main session decides A and F. F becomes issues, and E becomes one issue for the
  team. B, C and D go to a checklist comment on #129, which the user approves in one pass.
- **Done**: every finding is either queued, filed, or explicitly dropped with a reason.

### 4. Apply

- **What**: edit sub-agents work in separate worktrees, split by doc. They apply the A fixes and the
  approved B/C/D items. The main session reviews and integrates, with commits split by category.
- **Done**: the size of each part is measured before and after.

## Acceptance

- [x] Every A finding is fixed, or kept with a reason (41 confirmed + 7 partial, using the corrected fix; 3 false positives dropped; realtime-09/10 left because ADRs are not edited)
- [x] Every approved B/C/D item is applied (70 ticked on #129; skips are listed in the PR)
- [x] F and E are filed as issues: none needed. The 2 F findings were stale code comments, fixed here; there were no E findings. The open measurement questions moved to #42
- [x] `pnpm verify:docs`, `pnpm comments --strict`, `pnpm lint && pnpm test && pnpm build`
- [x] Size per part, before and after, recorded in the PR: 304,119 → 263,230 B (−13.4%), 4,430 → 3,772 lines (−14.9%)

## Cross-cutting

- `docs/SRS-ko.md` and `SRS-en.md` are not edited here: SRS changes need the team (`AGENTS.md` §5).
- The baseline is on #129.

## Review

**Shipped.** The audit ran in five stages:

1. One extractor agent.
2. Seven read-only audit agents, which produced 136 findings.
3. One agent that re-checked every A/F finding: 41 confirmed, 7 partial, 3 false.
4. A checklist on #129, where the user approved 70 items.
5. Three edit agents in separate worktrees, plus one handoff agent.

The integrated result is one commit per category, plus a commit for cross-doc moves. Along the way:
- `docs/HOST-GUEST-ENTRY-ko.md`, a personal study note, is archived.
- Copies of ADR-007/008/005 in the design docs are now links.
- AGENTS.md is 13% smaller.
- `post-merge-reminders` closes a drift-audit issue once the count resets.

**Not done:**
- ADR edits (realtime-09/10, and the ADR halves of some C items), because ADRs keep their history.
- 12 optional, low-confidence items that were left unticked.
- infra-12: the different `--strict` use between CI and `verify:docs` is deliberate.

**Archived in this PR.** Archiving the task here resets the audit count on merge. If it were archived later, the merge would close #135 while the count still stood at 5, and the post-merge job would open a new issue.
