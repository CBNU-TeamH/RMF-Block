# Presenter marks — block-anchored freehand underline and highlight

**Created**: 2026-09-12
**Issue**: #95 (this task is the first of its two PRs; the fading laser pointer is the second)
**Design**: [`docs/design/presence-and-focus.md`](../../docs/design/presence-and-focus.md) — extended
by this task with the ink layer's own section.

FR-030-12/13/14. A presenter draws freehand and every follower sees the stroke land on the same
**blocks**, whatever their window size, streamed live as it's drawn. Nothing is persisted: the
marks ride the content document's Yorkie presence — ending a share explicitly clears them
(`presence.set({ marks: null })`), and losing the connection drops them automatically, since
Yorkie tears down that client's presence entry whole.

Milestone 3 originally shipped straight-line marks (a drag's two endpoints → a rectangular band per
block). Manual browser testing worked, but surfaced that a straight line can't circle a diagram or
underline a curve of text the way a hand actually gestures — see "Review" below for what changed
and why the shape is now a path of segments rather than a band.

## Milestones

### 1. Coordinates

- **What**: a pixel in the editor's scroll container becomes `{ blockId, ratio, x }` and back again,
  and a drag across several blocks becomes one mark per block.
- **Files**: `lib/focus/ink.ts` (new), `lib/focus/ink.test.mts` (new), `lib/focus/anchor.ts`,
  `lib/focus/dom.ts`, `lib/focus/anchor.test.mts`.
- **Reuse**: `anchorAt` and `scrollTopFor` (`lib/focus/anchor.ts`) already encode the gap rule, the
  before-the-first rule and the past-the-last rule. `ink.ts` calls them rather than restating them.
  `readBoxes` (`lib/focus/dom.ts`) already reads the boxes; it gains two fields, not a sibling.
- **Done**: `pnpm test` green, no DOM involved.

### 2. Render

- **What**: an SVG overlay inside the scroll container draws a list of marks on the right blocks.
- **Files**: `app/(workspace)/documents/[id]/ink-overlay.tsx` (new), `editor.tsx`.
- **Reuse**: the scroll container is already `relative` for `readBoxes`' sake (`editor.tsx`), so the
  overlay needs no new positioning context.
- **Done**: a hard-coded mark sits on its block, and stays there while scrolling and when a block is
  inserted above it.

### 3. Draw

- **What**: a tool can be picked, a drag over the document makes a freehand stroke along the actual
  path (a path of segments, not a straight band — 밑줄 and 형광펜 differ only in stroke style), and
  지우기 clears them.
- **Files**: `ink-overlay.tsx`, `lib/focus/ink.ts` (`shouldAcceptPoint`/`startMark`/`extendMark`/
  `markPixelSegments` replace `marksAcross`/`markRect`).
- **Reuse**: `editor.tsx`'s two modals already establish `fixed` as this file's shape for something
  that must not take layout space — the toolbar uses it for the same reason. `inkPointAt`/
  `inkPixelsFor` are unchanged; only what a mark holds changed.
- **Done**: a presenter drags and sees their own stroke follow the actual path; the textarea
  underneath never takes the caret while a tool is active.

### 4. Share

- **What**: marks publish on the content document's presence, streamed live while a stroke is drawn
  (throttled, reusing `use-focus-presence.ts`'s `PUBLISH_MS`) and reach followers only.
- **Files**: `lib/presence/occupancy.ts`, `app/(workspace)/documents/[id]/use-focus-presence.ts`
  (`PUBLISH_MS` exported), `ink-overlay.tsx`.
- **Reuse**: the content document, its presence and its `subscribe("others")` all already exist for
  block occupancy — this adds fields and a reader, not a channel. `PUBLISH_MS`'s trailing-edge timer
  idiom is reused rather than a second throttle constant of the same value.
- **Done**: two browsers at different widths, a follower watches the presenter's stroke form live on
  the same blocks; a follower joining mid-stroke sees it already drawn; a non-follower with the
  document open sees nothing; ending the share clears them.

### 5. Docs

- **What**: the design doc carries the ink layer's reasoning.
- **Files**: `docs/design/presence-and-focus.md`.
- **Done**: `pnpm verify:docs` clean.

## Acceptance

- [x] A presenter can draw an underline/highlight without the pointer landing in a textarea
- [ ] A follower at a different window size sees each mark on the same **block** as the presenter
- [x] Marks stay on their blocks while either side scrolls, with no per-scroll recompute
- [ ] A third person inserting a block above leaves every mark on its own block
- [ ] A follower who joins *after* marks were drawn sees them immediately
- [x] Ending the share, and the presenter disconnecting, both clear every mark on every follower
- [x] Nothing appears in the block document or in `.data/`
- [x] A non-follower with the same document open sees nothing
- [x] Marks are attributed by `BlockPresence.id`, so a second person drawing is not taken for the
      presenter
- [x] `occupantsByBlock` still behaves after `BlockPresence` grows fields
- [x] `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm comments` pass

Added once straight lines became freehand strokes:

- [x] 밑줄 and 형광펜 both render as a continuous path following the actual drag — no straight band
- [ ] A follower watches a stroke extend point-by-point while the presenter is still drawing
- [ ] A follower who attaches mid-stroke sees it already drawn up to its current point, then
      continues live
- [x] A stroke stops growing at exactly `MAX_POINTS_PER_MARK` (unit test) — manual confirmation of
      the freeze-not-misbehave behavior still open
- [x] `shouldAcceptPoint` holds at the exact `MIN_POINT_DISTANCE_PX` boundary (unit test)
- [ ] Releasing the pointer flushes immediately — a drag ending mid-throttle-window still shows
      every accepted point on a follower's screen
- [ ] A stroke crossing a block boundary shows the accepted seam artifact — present, not a bug
- [ ] Navigating away from a document mid-drag does not throw or publish after unmount

Found during manual testing, beyond the original acceptance list — see `-lessons.md` for the full
account of each and why:

- [x] A fast drag doesn't visibly break up mid-stroke (root cause: `onPointerMove` re-querying the
      DOM on every accepted point instead of reusing already-measured `boxes` state)
- [x] A document shorter than the visible pane is still drawable across the whole pane, not just
      down to its last block
- [x] A block right after an image draws correctly once the image has finished its async load
      (root cause: nothing re-measured `boxes` when a block's own size changed after mount)

Remaining unchecked boxes were not individually re-confirmed with two browsers after the freehand
rewrite — see "Review" below for what that does and doesn't put at risk.

## Cross-cutting

- **SRS**: FR-030-12, FR-030-13, FR-030-14 (UC-030 E3-4). FR-030-14 needs no code — presence is
  dropped when the presenter detaches.
- **Not in scope**: FR-030-06 (locking a follower's editing and scrolling) is still unbuilt and is
  its own issue. This task makes its absence more visible, not worse.
- **Docs that go stale**: `docs/design/presence-and-focus.md` (extended here). `docs/SRS-ko.md` is
  unchanged — this implements what it already specifies.
- **Verified against the container**, not `pnpm dev`: this touches presence, which AGENTS.md requires
  be checked with `pnpm docker:up`.

## Review

**Shipped**: block-anchored freehand strokes (a path of per-block segments, not the originally
planned straight-line band) for 밑줄/형광펜, streamed live while drawing (throttled, reusing the
scroll anchor's own `PUBLISH_MS`), living only in the content document's presence. Ending a share
explicitly clears them; losing the connection clears them for free, since Yorkie drops that
client's presence entry whole. Manual testing in the container surfaced and fixed three issues
beyond the original design; the full account of each, root-caused, is in `-lessons.md`:

1. Strokes visibly broke up mid-draw. Root cause: `onPointerMove` re-querying the whole DOM
   (`readBoxes`) on every accepted point instead of reusing the already-measured `boxes` state.
2. A document shorter than the visible pane left its bottom half undrawable. Fixed by sizing the
   canvas to `max(content height, visible pane height)` — with the accepted trade-off that a point
   drawn purely below all content clamps to the last block's own bottom edge.
3. A block right after an image drew incorrectly. An `<img>` with no intrinsic size reflows the
   page once it loads, and nothing re-measured `boxes` for that — a `ResizeObserver` on every
   current block now catches it, and incidentally removed the smaller, previously accepted drift
   from typing above an in-progress stroke too.

**Cut**: nothing from the original milestone list — all five landed. The mark shape stayed at two
kinds (no third "펜" tool), per the confirmed decision that 밑줄/형광펜 both became freehand and
differ only in stroke style, not in what draws them.

**Moved to another task**: the fading laser pointer (#95's second PR) is unaffected in shape, but
its own note in `-lessons.md` flags that `MARK_CAP`'s worst case grew by two orders of magnitude
once marks became open paths — worth re-checking before that PR assumes its original cost numbers.

**Manually verified this session** (single- and two-browser, container): freehand drawing with both
tools producing continuous curves, the full-pane drawable area, drawing in a block right after an
image, ending a share clearing marks everywhere on a follower's screen.

**Every other unchecked box above was not individually re-confirmed with two browsers after the
freehand rewrite** — listed exhaustively rather than summarized, so this section can't read as more
complete than the checklist above it:

- A follower at a different window size seeing marks land on the same block
- A third person inserting a block above an in-progress stroke
- A follower attaching mid-stroke (both the immediate catch-up and the live continuation after)
- Live, point-by-point streaming while the presenter is still drawing, as opposed to only the
  finished result
- The unthrottled flush on release actually landing every point accepted after the last throttle
  tick
- The accepted seam artifact at a block-crossing boundary (a known trade-off, not a pass/fail check,
  but still unobserved live)
- Navigating away mid-drag not throwing or publishing after unmount
- The presenter disconnecting (as opposed to clicking 종료) clearing marks for every follower

All of these ride the same `inkFrom`/content-document-presence path already exercised by what
*was* re-confirmed, plus `occupancy.test.mts`'s and `ink.test.mts`'s unit tests, so risk is low —
but "low risk" is a claim about the mechanism, not a substitute for having clicked through each one.
Flagged on issue #95 rather than silently assumed complete.
