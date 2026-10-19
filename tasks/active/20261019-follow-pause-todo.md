# Pause a follower who scrolls, edits or moves on, and resume (UC-030)

**Created**: 2026-10-19
**Issue**: #105 (re-scoped by #220)
**Design**: [Presence and focus following](../../docs/design/presence-and-focus.md)

## Milestones

### 1. Paused is a follow state

- **What**: a follow can be paused and resumed (FR-030-08). While paused nothing pulls the follower's view and the header offers 재개 and 종료; 재개 brings them back to the presenter's current document and position (E3-1 step 6).
- **Files**: `app/(workspace)/focus-follow-provider.tsx`, `app/(workspace)/focus-share.tsx`, `app/(workspace)/documents/[id]/editor.tsx` (the ink overlay keeps showing the paused presenter's marks).
- **Reuse**: the follow state and FR-030-05's crossing effect in the provider; the follower effect in `use-focus-presence.ts`, which already forgets its last commanded position when there is nothing to follow, so resuming re-scrolls even to an anchor that has not moved.
- **Done**: 일시 정지 stops the view following, 재개 re-syncs it, and 종료 works from either state.

### 2. The follower's own move pauses it

- **What**: a follower who scrolls the document, presses inside it (which starts any edit), types into it, opens another document, or jumps to someone (UC-040) or a file's block (UC-050) is paused rather than pulled back (FR-030-06, E3-1 step 1). The jump no longer asks to end the follow.
- **Files**: `app/(workspace)/documents/[id]/use-focus-presence.ts`, `app/(workspace)/focus-follow-provider.tsx`.
- **Reuse**: the editor's scroll container (`data-focus-scroll`); `goTo` in the provider.
- **Done**: the follow's own smooth scroll, a remote edit and the editor's automatic trailing block never pause it; a wheel, a touch, a press, an edit or a navigation of the follower's own does.

### 3. Tell the follower the share ended

- **What**: when the presenter ends the share or disconnects, the follower sees "공유가 종료되었습니다" for a few seconds (E3-3 step 3, FR-030-11).
- **Files**: `app/(workspace)/focus-follow-provider.tsx`, `app/(workspace)/focus-share.tsx`.
- **Reuse**: the render-time branch that already forgets a follow whose presenter stopped.
- **Done**: the notice shows for a follower, active or paused, and not for one who left with 종료.

## Test selection

- Vitest (logic / component / server / route): `focus-follow-provider.test.tsx` rewritten around the new behaviour — a jump and 원본 위치 pause instead of asking; pause and resume; the follower opening another document, or a page that is not one, pauses; the presenter opening another takes the follower along once; 재개 re-crosses to the presenter's document; the end notice shows for an active or paused follower and not after 종료, and clears after `SHARE_ENDED_MS`. `focus-share.test.tsx` extended — 일시 정지 beside 종료, 재개 and 종료 while paused, the notice beside the next control. New `documents/[id]/use-focus-presence.test.tsx` — a wheel, touch, press or typing pauses; a `scroll` alone does not; nothing listens while not following.
- Browser E2E (`e2e/`): new `e2e/follow.e2e.ts` — a real wheel pauses the follow, the presenter's move does not reach the paused view, 재개 lands on the presenter's block, and the end is announced. `e2e/perf/round.perf.ts` is unchanged: it still finds the follower by the `…따라가는 중 · 종료` button, which keeps its name.
- Container smoke (`.github/workflows/ci.yml`): no change — startup, auth and networking are untouched.
- Commands and observed results (fill in before the PR):
  - `pnpm typecheck`, `pnpm lint`: clean. `pnpm test`: 78 files, 837 tests passed. `pnpm comments`, `pnpm verify:docs`: clean (after `pnpm tasks:index`).
  - `e2e/follow.e2e.ts`: type-checked and collected (1 test); not run here — this machine has no Playwright browsers, so CI's E2E step runs it.
  - In Chrome on the isolated stack, host on `localhost:3100` and a guest follower on `127.0.0.1:3100`:
    - The follower's header showed `…따라가는 중 · 종료` with 일시 정지.
    - A real click inside the document paused it.
    - The host scrolled to the bottom and the paused follower stayed at its position.
    - 재개 brought the follower to the host's position.
    - A wheel event paused it.
    - Typing into a block that was focused without a press paused it (`beforeinput`).
    - Not yet seen there: a route change of the follower's own, and the end notice. The extension disconnected first.
  - The browser tool's scroll action fires no `wheel` event (it scrolls by script), so in that tool a scroll does not pause. A real wheel or trackpad does, as `e2e/follow.e2e.ts`'s `mouse.wheel` does.

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] A follower's own scroll, press, edit or navigation pauses the follow; the presenter's moves and remote edits do not.
- [ ] 재개 re-syncs to the presenter's current document and position; 종료 ends the follow from either state.
- [ ] "공유가 종료되었습니다" shows when the presenter ends or leaves.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm verify:docs`, `pnpm comments` pass.

## Cross-cutting

FR-030-06/08/10/11, UC-030 E3-1 and E3-3, as changed by #220. The UC-040 jump and UC-050's 원본 위치 stop asking to end a follow and pause it instead. `presence-and-focus.md` gets the design. After the PR: #105's title, and the v0.2.0 milestone's description.

## Review

Filled in at the end.
