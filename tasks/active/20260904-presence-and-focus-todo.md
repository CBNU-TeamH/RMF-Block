# `docs/design/presence-and-focus.md` + the wrong/dangling comments found reading it

**Created**: 2026-09-04
**Issue**: #65 (Phase 1, track B, of #67)
**Design**: this task's own deliverable is the design doc. Full derivation: the harness review
linked from #67.

One PR, two milestones. Milestone 2's file list spans beyond presence/focus (`tsconfig.json`,
`app/api/documents/route.ts`, `scripts/tasks-archive.sh`) but every fix in it is one line — found
while reading the files milestone 1 requires anyway. Splitting would double the review overhead
for work this size.

## Milestones

### 1. `docs/design/presence-and-focus.md`

- **What**: a new design doc, capability-sized like the four that already exist
  (`architecture.md`, `api.md`, `chat.md`, `document-editing.md`) rather than module-sized.
  Destination for rationale currently stuck in comments with no `docs/` home: why presence rides
  Yorkie rather than the WS hub, the `WORKSPACE_DOC_KEY` singleton-document trick,
  `WorkspacePresence` reusing `WorkspaceMember`, `HOST_PRESENCE`'s fixed id/color, why the shared
  focus anchor is `{blockId, ratio}` and not raw `scrollTop`, the 1%-quantization decision, and
  whatever `lib/focus/dom.ts` / `lib/focus/pathname.ts` / `focus-follow-provider.tsx` /
  `focus-share.tsx` are carrying that has nowhere else to live.
- **Files**: new `docs/design/presence-and-focus.md`. Read-only for content:
  `lib/presence/types.ts`, `lib/focus/anchor.ts`, `lib/focus/dom.ts`, `lib/focus/pathname.ts`,
  `app/(workspace)/focus-follow-provider.tsx`, `app/(workspace)/focus-share.tsx`.
- **Reuse**: the `**Status**` / `**Related**` header convention from the other four design docs.
  `lib/documents/documents.ts`'s rationale (catalogue split from Yorkie content, `createdBy`
  naming, sync-write, write-then-rename atomicity) does **not** come here — it goes to the
  existing `docs/design/document-editing.md`, checked against what's already there first so
  nothing is duplicated.
- **Done**: an `**Owns**:` line at the top naming `lib/presence/`, `lib/focus/`,
  `app/(workspace)/focus-follow-provider.tsx`, `app/(workspace)/focus-share.tsx`,
  `app/(workspace)/presence-provider.tsx`, `app/(workspace)/documents/[id]/use-focus-presence.ts`
  — the convention track C's ownership checker will read.

### 2. Wrong and dangling comments (C7a)

- **What**: comments found reading the files above that are outright wrong or will break, not
  merely long.
  - `tsconfig.json:14-17` — credits the *test runner* for `allowImportingTsExtensions`; the real
    reason is production (`server/index.mts` runs directly under `node`, importing `.ts`-suffixed
    paths literally). Reword to point at `docs/conventions.md`'s "Node type-stripping constraint"
    section. **That link won't resolve until `#69` merges** — the content is stable now (already
    written in that PR), the path/anchor is final, only the merge is pending. Note this in Review
    below rather than blocking on it.
  - Six comments pointing at `tasks/active/*.md`, which die the moment the referenced task
    archives: `lib/focus/anchor.ts:23`, `app/(workspace)/focus-share.tsx:18`,
    `app/(workspace)/focus-follow-provider.tsx:14`, `lib/presence/types.ts:10`,
    `lib/presence/types.ts:36` → repoint at `docs/design/presence-and-focus.md`.
    `app/api/documents/route.ts:14` → repoint at `docs/design/document-editing.md`, or an inline
    restatement if the rationale is archival rather than something that doc should carry.
  - Nine `ponytail:` → `simple:` renames: `app/(workspace)/documents/[id]/text-block.tsx:337`,
    `app/(workspace)/documents/[id]/use-focus-presence.ts:11`,
    `app/(workspace)/focus-share.tsx:38`, `app/(workspace)/presence-provider.tsx:206`,
    `app/(workspace)/presence-provider.tsx:211`, `app/api/auth/host/route.ts:11`,
    `lib/auth/member-repository.ts:17`, `lib/focus/anchor.ts:33`, `lib/host-secret.ts:8`. Plus a
    tenth not in that count: `scripts/tasks-archive.sh`'s own `# ponytail: filename fallback…`
    comment.
- **Files**: the files listed above, plus `app/api/documents/route.ts`, `scripts/tasks-archive.sh`,
  `tsconfig.json`.
- **Reuse**: the `simple:` convention `docs/conventions.md` already defines (`#69`) — this
  milestone executes the rename, doesn't invent the name.
- **Done**: `grep -rn "ponytail:" app lib scripts` returns nothing; the six dangling pointers
  resolve to real docs; a comment is left on `#37`, which references the exact marker at
  `presence-provider.tsx:211` by name.

## Acceptance

- [x] `docs/design/presence-and-focus.md` exists with an `**Owns**:` line listing only paths that
      exist.
- [x] `grep -rn "ponytail:" app lib scripts` is empty. 10 markers renamed to `simple:` (nine in
      source, one in `scripts/tasks-archive.sh`).
- [x] `grep -rn "tasks/active/2026" lib app` and the unpathed "this task's todo" phrasing return
      nothing for the six identified spots.
- [x] A comment is left on `#37` noting the marker rename.
- [x] `bash scripts/tasks-index.sh` is idempotent.

## Cross-cutting

- **Depends on `#69`'s content, not its merge**, for one link (`tsconfig.json`'s repointed
  comment). If `#69` changes its heading text before merging, this PR's one line needs a follow-up
  fix — checked again before this PR is marked ready.
- **Track C (`chore/verify-scripts`)** depends on this PR's `**Owns**:` line for its ownership
  checker; expects `lib/focus` and `lib/documents` to show zero coverage holes once this and the
  existing `document-editing.md` both claim their share.
- No SRS requirement covers this; nothing in `docs/SRS-ko.md` changes.

## Review

Shipped both milestones as planned. Three things worth noting:

- **`app/api/documents/route.ts`'s dangling pointer went to an inline restatement, not
  `document-editing.md`.** That doc doesn't cover why documents are seeded on first editor-open
  rather than at creation, and adding it there would have been scope creep into a file this task
  wasn't otherwise touching. Restated the one sentence inline instead — surgical, matches
  `AGENTS.md` §3 principle 3.
- **The `lib/documents/documents.ts` rationale mentioned in this task's original cross-cutting
  note never came up** — that file wasn't actually in milestone 1's read list, only
  `app/api/documents/route.ts`'s one comment was in scope, and that got the inline-restatement
  treatment above instead of moving anything into `document-editing.md`.
- The `tsconfig.json` and `presence-and-focus.md` links into `docs/conventions.md` are confirmed
  correct against `#69`'s content but **will not resolve until `#69` merges** — checked again
  right before this PR is marked ready, per the plan.
