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

### 3. Announce a share's start and end

- **What**: a card drops in from the top of the window and goes back up a few seconds later, like a phone's notification. When another member starts presenting, it says "화면 공유를 시작했습니다" with 참여하기 (FR-030-03, step 3). When the followed presenter ends the share or disconnects, it says "공유가 종료되었습니다" (E3-3 step 3, FR-030-11). Each card shows the presenter's name.
- **Files**: `app/(workspace)/focus-follow-provider.tsx`, `app/(workspace)/focus-share.tsx`.
- **Reuse**: the render-time branch that already forgets a follow whose presenter stopped; `flash`'s use of the Web Animations API.
- **Done**:
  - The start card shows only when a member in the last roster starts presenting: not for a share already running, a presenter coming back, or this member's own share. It joins from its button, and goes when the share ends.
  - The end card shows for a follower, active or paused, names a presenter who has already left the roster, and does not show for a follower who left with 종료.

## Test selection

- Vitest (logic / component / server / route): `focus-follow-provider.test.tsx` rewritten around the new behaviour — a jump and 원본 위치 pause instead of asking; pause and resume; the follower opening another document, or a page that is not one, pauses; the presenter opening another takes the follower along once; 재개 re-crosses to the presenter's document; the end notice carries the presenter's name, shows for an active or paused follower (including one whose presenter left the roster) and not after 종료, and clears after `SHARE_ENDED_MS`; the start notice shows for a member who starts presenting, not for the first roster, a presenter's return or this member's own share, and goes on following, on the share ending, or after `SHARE_STARTED_MS`. `focus-share.test.tsx` extended — 일시 정지 beside 종료, 재개 and 종료 while paused, the end card with the presenter's name while the control moves on, the start card joining from its own button. New `documents/[id]/use-focus-presence.test.tsx` — a wheel, touch, press or typing pauses; a `scroll` alone does not; nothing listens while not following.
- Browser E2E (`e2e/`): new `e2e/follow.e2e.ts` — the start card appears and joins, a real wheel pauses the follow, the presenter's move does not reach the paused view, 재개 lands on the presenter's block, and the end is announced. `e2e/perf/round.perf.ts` is unchanged: it still finds the follower by the `…따라가는 중 · 종료` button, which keeps its name.
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
    - The follower opened 파일 in the sidebar: stayed on `/files`, paused, not pulled back.
    - 재개 from there returned the follower to the presenter's document, following again.
    - The host's 공유 종료 dropped the card in at the top centre (the presenter's avatar, "Host", "공유가 종료되었습니다"). It was gone 4.5s later, and the follower's control had moved on to 공유하기.
    - The host's 공유하기 dropped the start card in on the guest ("Host", "화면 공유를 시작했습니다", 참여하기). A watcher logged it at 2.5s after the start and gone at 8.5s, 6s on.
    - The card's 참여하기 started the follow (`Host님을 따라가는 중 · 종료`) and closed the card.
    - Not announced: ending and restarting the share within about a second. Yorkie sends a client's presence changes within one sync together, so the guest never saw the share stop; the header's 참여하기 still offered it.
  - The browser tool's scroll action fires no `wheel` event (it scrolls by script), so in that tool a scroll does not pause. A real wheel or trackpad does, as `e2e/follow.e2e.ts`'s `mouse.wheel` does.

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] A follower's own scroll, press, edit or navigation pauses the follow; the presenter's moves and remote edits do not.
- [ ] 재개 re-syncs to the presenter's current document and position; 종료 ends the follow from either state.
- [ ] "화면 공유를 시작했습니다" with 참여하기 shows when another member starts presenting; "공유가 종료되었습니다" shows when the followed presenter ends or leaves.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm verify:docs`, `pnpm comments` pass.

## Cross-cutting

FR-030-06/08/10/11, UC-030 E3-1 and E3-3, as changed by #220. The UC-040 jump and UC-050's 원본 위치 stop asking to end a follow and pause it instead. `presence-and-focus.md` gets the design. After the PR: #105's title, and the v0.2.0 milestone's description.

## Review

Filled in at the end.
