# ADR maintenance: fix a cross-reference gap, add 4 new ADRs

**Created**: 2026-09-17
**Issue**: none — routine doc maintenance, prompted by a request to audit `docs/adr/`
**Design**: no `docs/design/` doc — this task edits `docs/adr/` itself, plus one-line
cross-reference pointers into `docs/design/chat.md` and `docs/design/document-editing.md`,
which already carry the detailed reasoning these ADRs summarize.

Two problems, found by reading all four existing ADRs end to end and comparing them against
`docs/design/*` and the currently open PR #107:

1. ADR-001's Status line was retroactively updated when ADR-002 partially superseded it. ADR-003
   never got the same treatment when ADR-004 superseded its Decision 4 — an inconsistency in the
   existing set, not a new judgment call.
2. Four architectural decisions exist only as design-doc prose (or, for PR #107, only as an open
   PR) despite being exactly the "why X and not Y, with rejected alternatives" shape ADRs exist
   for. Picked from a broader 11-candidate survey.

## Milestones

### 1. Fix ADR-003's forward reference

- **What**: add a Status-line note mirroring ADR-001's pattern (`Decision 4 superseded by
  ADR-004 (2026-09-09); Decisions 1, 2, 3, and 5 stand.`), and a one-line pointer from Decision 2
  to the new ADR-005.
- **Files**: `docs/adr/003-stack-choices.md`.
- **Reuse**: ADR-001's own Status line is the pattern being mirrored.
- **Done**: ADR-003 reads consistently with how ADR-001 handles being partially superseded.

### 2. Four new ADRs

- **What**: `docs/adr/005-custom-server-rest-ws.md`, `006-workspace-chat-socket-auth.md`,
  `007-block-array-not-tree.md`, `008-textarea-editing-surface.md` — each following the
  established template (Status/Date/Related/Supersedes header, Context/Decision/Consequences/
  Alternatives considered, plus a closing "What this ADR does not claim" section where the
  material is design-doc-reconstructed rather than freshly deliberated).
- **Files**: the four new ADR files; one-line "See ADR-00X" pointers added at the source section
  in `docs/design/chat.md` ("Why a custom server is unavoidable here") and
  `docs/design/document-editing.md` ("Why an Array of blocks, and not one `yorkie.Tree`",
  "Editing surface").
- **Reuse**: nearly all of the reasoning, measured evidence, and rejected alternatives already
  exist in prose in `docs/design/chat.md` and `docs/design/document-editing.md`; ADR-006 reuses
  PR #107's own description and issue #83. No new research — this is promoting existing
  reasoning into the ADR record, not producing new reasoning.
- **Done**: each decision has a standalone ADR a future contributor can read without
  reconstructing "why" from scattered prose or an open PR.

## Acceptance

- [x] `docs/adr/003-stack-choices.md` Status line notes ADR-004's supersession of Decision 4
- [x] `docs/adr/003-stack-choices.md` Decision 2 points forward to ADR-005
- [x] Four new ADR files exist, each matching the established template shape
- [x] `docs/design/chat.md` and `docs/design/document-editing.md` carry pointers to the new ADRs
      at the sections they were drawn from (see Review for the one deviation, in `chat.md`)
- [x] `pnpm verify:docs` passes
- [x] Every new/edited cross-reference link resolves (ADR↔ADR, ADR↔design doc, ADR↔issue) —
      confirmed via `pnpm verify:docs`'s dead-link check (clean)

## Cross-cutting

Doc-only change — no code, no schema, no config touched. ADR-006 is written assuming PR #107
merges (per direction); if PR #107 changes materially before merging, ADR-006 needs correcting
to match what actually lands.

## Review

Shipped as planned: ADR-003's Status line and Decision 2 now point forward correctly, and four
new ADRs (005–008) record decisions that previously lived only in design-doc prose or an open
PR. `docs/design/chat.md` and `docs/design/document-editing.md` each got a one-line pointer at
the section their content was drawn from.

One deviation from the original one-line-pointer plan: `chat.md`'s "chat never required
authentication" paragraph needed a short addendum, not a bare pointer, because PR #107 itself
already rewrites that exact paragraph with a strikethrough when it merges — adding a second,
independent rewrite here would have fought that PR's own diff. The addendum notes the
supersession without touching the paragraph's original wording, so PR #107's rewrite still
applies cleanly.

Nothing was cut. `pnpm verify:docs` is clean (no dead links, no task-index drift).
