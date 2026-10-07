# User location tracking — who is in which document, and jump to them

**Created**: 2026-10-07
**Issue**: #142 (UC-040, WBS 8.1, milestone v0.0.1)
**Design**: [`docs/design/api.md`](../../../../docs/design/api.md) ("What is **not** answered…") and [`docs/design/presence-and-focus.md`](../../../../docs/design/presence-and-focus.md); the server-index design in api.md is superseded by Plan §1 below and gets rewritten in the same PR.

## Plan

Decisions the issue left open (settled with the user 2026-10-07):

1. **Where "current document" lives** — a `location: { documentId, blockId } | null` field on `WorkspacePresence` (Yorkie workspace doc). No server change, and it vanishes with the connection. The `userId → documentId` server index in api.md is dropped and `api.md` is rewritten.
2. **What "screen position" means (FR-040-02)** — the app's only per-document "cursor" is `BlockPresence.activeBlockId` (`lib/presence/occupancy.ts`, published by `use-block-document.ts`); the text caret offset is not synced anywhere. So the jump target is the target's last focused block, scrolled into view — no scroll ratio. `activeBlockId` itself ages out after 30s, so the editor also publishes the block into `WorkspacePresence.location` (not cleared on blur); a member who never focused a block lands at the document top.
3. **Return (FR-040-03)** — one remembered position (document + block) per jump; a second jump replaces it.
4. **Disconnected members (FR-040-04)** — the roster covers **all** members: `.data/members.json` (via `sessionRegistry.members()`) merged with live presence. The top nav shows only the viewer and the members in the open document, then the not-connected ones at its end, dimmed and not clickable (folded into "+N" past four).
5. **Where to jump from (settled after the by-hand run)** — the **document tree** is where you find and go to people: a row with anyone else in it shows up to three colour dots (+N), and a dot is a button that jumps to that person. The nav does not jump. The earlier "2 or more" threshold was dropped — one other person is enough.
6. **Jumping while following (UC-030)** — a jump while following asks `window.confirm` ("따라가기를 종료하고 이동하시겠습니까?"); declining stays put and keeps following.
7. **Not touched**: #37, #127, #124 — only check that none collides with the new field.

## Milestones

### 1. Publish the current document

- **What**: each client sets `documentId` in its workspace presence on entering/leaving a document.
- **Files**: `lib/presence/types.ts`, the workspace presence provider, `app/(workspace)/documents/[id]/…` (set/clear).
- **Reuse**: existing presence publish path used for `presenting`; `null`, never `undefined`, to clear.
- **Done**: unit test on the presence shape; two clients show each other's `documentId`.

### 2. Nav: who is here, and who is not connected

- **What**: `presence-stack.tsx` lists the viewer and the members in the open document; members not connected come last, dimmed and unclickable. A **돌아가기** button appears after a jump.
- **Files**: `app/(workspace)/presence-stack.tsx`, `layout.tsx` (passes `sessionRegistry.members()` without `lastJoinedAt`).
- **Reuse**: `withOffline` in `lib/presence/roster.ts`; `WorkspaceMember` colour tag (FR-020-08).
- **Done**: a member in another document is absent from the nav; one who disconnects turns dim.

### 3. Jump and return

- **What**: `jumpTo(memberId)` in `focus-follow-provider.tsx` routes to the target's document and hands the editor their last focused block to scroll to (`use-focus-presence.ts`, via `readBoxes`); `goBack` restores the one remembered place.
- **Files**: `focus-follow-provider.tsx`, `use-focus-presence.ts`, `editor.tsx`.
- **Reuse**: the focus-follow navigation path (UC-030).
- **Done**: jump → lands on the target block (or document top if none); back → returns; jumping while following asks first.

### 4. The document tree: where people are, and a way to them

- **What**: `document-list.tsx` shows colour dots for the others in each document; a dot jumps to that person.
- **Files**: `app/(workspace)/document-list.tsx`.
- **Reuse**: `occupantsByDocument` in `lib/presence/roster.ts`.
- **Done**: another member's document carries their dot on my screen; clicking it jumps; a document only I am in shows none.

### 5. Docs

- **Files**: `docs/design/api.md`, `docs/design/presence-and-focus.md`, `docs/SRS-en.md`/`SRS-ko.md` untouched (requirements unchanged).

## Acceptance

- [x] FR-040-01 … FR-040-04: unit and component tests (`roster.test.mts`, `presence-stack.test.tsx`, `document-list.test.tsx`, `focus-follow-provider.test.tsx`)
- [x] Two-browser check against the container — run by the author on the first design (all passed); the reworked nav/tree/confirm is re-checked by hand before merge
- [x] `pnpm verify:docs`, and pre-push hook (test + build) green
- [x] `/simplify` and `/code-review low` run, findings applied (twice — first design and the rework), plus CodeRabbit's four

## Cross-cutting

FR-040-01..04, NFR-USA-003, SIR009. Presence shape changes overlap #124 (follower count) — keep the new field independent of it.

## Review

Shipped in #167. What landed differs from the plan above in one place, decided after the first by-hand run:

- **Shipped**: `location { documentId, blockId }` on workspace presence; the header roster lists the viewer and the members in the open document, then every recorded member not connected (dimmed); the **document tree** carries a dot per other member and a dot is the jump; 돌아가기 returns to one remembered place, including the page with no document; a jump while following asks first (`window.confirm`).
- **Changed from the plan**: the jump moved from the header avatars to the tree, and the tree's "2 or more people" threshold was dropped — one other person is enough. The nav no longer jumps.
- **Cut / moved**: a home page and tabbed documents → #168. Swapping `window.confirm` for a `<dialog>` and a flex row for the tree dots were left as notes in the PR, not filed.
