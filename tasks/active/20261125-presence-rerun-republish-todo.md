# Republish the focused block when the editor's effect re-runs

**Created**: 2026-11-25
**Issue**: #127
**Design**: [floating-view.md](../../docs/design/floating-view.md) ("One attachment per document, shared", the second rule); [presence-and-focus.md](../../docs/design/presence-and-focus.md).

## Plan

#127 asks to reset the shared presence only when a release drops the share count to zero. Read against the code, that would undo a rule the floating-view doc sets on purpose:

- The editor's effect cleanup (`use-block-document.ts`) clears `activeBlockId`, `marks` and `pointer` on every release **because a release no longer detaches**. With a floating view still holding the document, peers would otherwise see this browser on its last block for the 30 s occupancy TTL, and followers would see a presenter's old ink.
- A floating view never clears presence on release (`floating-views.tsx`, its cleanup only calls `releaseBlockDocument`). So the only clear that can hit "another holder still using it" is the editor's own cleanup, and that is the editor leaving — which wants the clear.
- The flicker the issue found is the editor's effect **re-running** (Strict Mode's second run, or a changed `colorTag` / `nickname`): cleanup clears, the next run re-acquires, and the focused block's highlight stays gone until the next `OCCUPANCY_TICK_MS` heartbeat (5 s).

So the cleanup stays as it is. The re-run republishes what it just cleared. Decided with the user on 2026-11-25; the other options (reset at count zero, or closing #127 unfixed) were declined.

## Milestones

### 1. Republish the focused block right after re-acquire

- **What**: after a run's `acquire` and identity update, publish `focusedBlockIdRef.current` if there is one, so a re-run does not leave peers without the highlight for up to 5 s.
- **Files**: `app/(workspace)/documents/[id]/use-block-document.ts` (next to the `presence.set({ colorTag, nickname })` call); the floating-view doc's second rule gets one sentence saying a re-run republishes.
- **Reuse**: `publishActiveBlock` (the heartbeat's and `setActiveBlockId`'s own writer) and `focusedBlockIdRef`, which survives the re-run because it is a ref.
- **Safe across documents**: `page.tsx` keys `DocumentEditor` by `document.id`, so one hook instance never sees a second `documentId` and the ref cannot hold another document's block.
- **Done**: a hook test focuses a block, re-runs the effect (a changed `nickname`), and sees that block published again without waiting a tick; a first run with nothing focused publishes none.

## Test selection

- Vitest (logic / component / server / route): a hook test for `useBlockDocument` with a fake client — `use-focus-presence.test.tsx` is the neighbour to copy the setup from; `attach-pool.test.mts` already shows a pool over a fake `Client`. Risk to settle first: whether `presence.set` works on a document the fake `attach` never really attached; if not, the republish moves into a tiny function the test can call directly.
- Browser E2E (`e2e/`): no new spec. Existing presence specs must still pass in CI; the editor-leaves-with-a-floating-view behavior is untouched, so none should change.
- Container smoke (`.github/workflows/ci.yml`): no change — nothing touches startup, auth or networking.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] The cleanup's clear is unchanged: leaving the editor with a floating view open still drops this browser's block for peers.
- [ ] After a re-run (changed nickname), the focused block is republished at once.
- [ ] The flicker itself was not reproduced in a browser (the issue says so); the hook test is the pin.

## Cross-cutting

Presence display (the occupancy highlight); NFR-REL-001 is not affected. No SRS, storage or API change.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
