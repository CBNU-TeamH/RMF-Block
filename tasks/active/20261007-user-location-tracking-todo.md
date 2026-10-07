# User location tracking — who is in which document, and jump to them

**Created**: 2026-10-07
**Issue**: #142 (UC-040, WBS 8.1, milestone v0.0.1)
**Design**: [`docs/design/api.md`](../../docs/design/api.md) ("What is **not** answered…") and [`docs/design/presence-and-focus.md`](../../docs/design/presence-and-focus.md); the server-index design in api.md is superseded by Plan §1 below and gets rewritten in the same PR.

## Plan

Decisions the issue left open (settled with the user 2026-10-07):

1. **Where "current document" lives** — a `location: { documentId, blockId } | null` field on `WorkspacePresence` (Yorkie workspace doc). No server change, and it vanishes with the connection. The `userId → documentId` server index in api.md is dropped and `api.md` is rewritten.
2. **What "screen position" means (FR-040-02)** — the app's only per-document "cursor" is `BlockPresence.activeBlockId` (`lib/presence/occupancy.ts`, published by `use-block-document.ts`); the text caret offset is not synced anywhere. So the jump target is the target's last focused block, scrolled into view — no scroll ratio. `activeBlockId` itself ages out after 30s, so the editor also publishes the block into `WorkspacePresence.location` (not cleared on blur); a member who never focused a block lands at the document top.
3. **Return (FR-040-03)** — one remembered position (document + block) per jump; a second jump replaces it.
4. **Disconnected members (FR-040-04)** — the roster shows **all** members: `.data/members.json` (via `member-repository`) merged with live presence; absent ones are dimmed and not selectable. Overflow is already folded into "+N".
5. **Document-tree tags** — a smaller version of the top-nav location chips (`presence-avatar`), colour dots only; shown when 2 or more users are in the document (user's wording: "2명 이상"), folded to "+N" beyond what fits. The exact threshold semantics are re-confirmed in review (see Open points).
6. **Jumping while following (UC-030)** — a jump ends the follow, and an alert tells the user so.
7. **Not touched**: #37, #127, #124 — only check that none collides with the new field.

## Milestones

### 1. Publish the current document

- **What**: each client sets `documentId` in its workspace presence on entering/leaving a document.
- **Files**: `lib/presence/types.ts`, the workspace presence provider, `app/(workspace)/documents/[id]/…` (set/clear).
- **Reuse**: existing presence publish path used for `presenting`; `null`, never `undefined`, to clear.
- **Done**: unit test on the presence shape; two clients show each other's `documentId`.

### 2. Roster shows location and disconnected members

- **What**: `presence-stack.tsx` shows each user's document; members not connected appear dimmed and unselectable.
- **Files**: `app/(workspace)/presence-stack.tsx`, a members read path (reuse `lib/auth/member-repository.ts`).
- **Reuse**: `WorkspaceMember` colour tag (FR-020-08); NFR-USA-003 keeps occupancy and location visually distinct.
- **Done**: a member who disconnects turns dim and cannot be clicked.

### 3. Jump to a user and return

- **What**: clicking an avatar routes to their `documentId` and scrolls to their `activeBlockId`; a "back" control restores the remembered position.
- **Files**: `presence-stack.tsx`, a small jump/return state beside `focus-follow-provider.tsx`, `use-block-document.ts` (scroll-into-view of a block).
- **Reuse**: the focus-follow navigation path (UC-030) — read it before writing a second one.
- **Done**: jump → lands on target block (or document top if none); back → returns to the origin document/block; jumping while following ends the follow and raises an alert.

### 4. User tags in the document tree

- **What**: `document-list.tsx` tags documents with the users currently inside.
- **Files**: `app/(workspace)/document-list.tsx`.
- **Reuse**: `presence-avatar.tsx` at a smaller size.
- **Done**: when 2+ users are in a document, its row shows their dots on the other client.

### 5. Docs

- **Files**: `docs/design/api.md`, `docs/design/presence-and-focus.md`, `docs/SRS-en.md`/`SRS-ko.md` untouched (requirements unchanged).

## Acceptance

- [x] FR-040-01 … FR-040-04: unit and component tests (`roster.test.mts`, `presence-stack.test.tsx`)
- [ ] Two-browser check against the container (not run yet)
- [ ] Two browser contexts: move between documents → tag follows; click → jump; back → return; disconnect → dim
- [ ] `pnpm verify:docs`, and pre-push hook (test + build) green
- [ ] `/simplify` and `/code-review low` run, findings applied

## Cross-cutting

FR-040-01..04, NFR-USA-003, SIR009. Presence shape changes overlap #124 (follower count) — keep the new field independent of it.

## Open points

- Doc-tree tag: "2명 이상" read as "show tags only when ≥2 users are in the document". If it meant "fold into +N from the 2nd user on", change milestone 4.

## Review

_Filled in at the end._
