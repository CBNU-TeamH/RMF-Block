# Focus following — follow the presenter's view

**Created**: 2026-09-01
**Issue**: —
**Design**: No separate doc in `docs/design/`. This slice needs exactly two decisions —
what a "view position" is on the wire, and where it travels — and both are settled below.
A design doc earns its place when the deferred half comes back (follower lock, pause/resume,
presenter tools), because that half is where session *state* starts existing.

## Goal

The thinnest UC-030 that is still the feature: **공유 → 참여 → 시점 따라감 → 종료 → 시점 안
따라감.** A presenter presses share; everyone else sees that someone is presenting and can
join; joining brings them to the presenter's document and position and keeps them there;
either side can end it and the follower goes back to moving on their own.

In scope: FR-030-01 (start), FR-030-04 (join), FR-030-05 (jump to the presenter's document
and position on join), FR-030-07 (keep up in real time), FR-030-09 (follower ends),
FR-030-11 (presenter's disconnect ends the session).

Out of scope, each with a reason:

- **FR-030-06, the follower's edit and scroll lock.** The feature demonstrates without it,
  and a lock is a permission concept — it has to decide what happens to a half-typed block
  and to a follower who was already editing. That deserves its own slice. See "What shipping
  without the lock actually feels like" under milestone 3.
- **FR-030-08/10, pause and resume.** A second follower state on top of a first one that has
  not been built yet. 종료 covers the "let me go" case for now, which is what a room of eight
  people sitting together actually needs.
- **FR-030-03's notification.** A top-bar affordance says a presentation is running and
  offers the way in. A toast is a second surface for the same fact.
- **FR-030-12/13/14, presenter highlight tools.** Its own feature — it writes highlight
  metadata into the document and then has to clean it up (FR-030-14). Nothing here blocks it.

## The decision: what travels is an anchor, not a scroll position

**A scroll `y` is not a shared coordinate.** The same `y` points at different content in two
browsers as soon as anything differs — viewport height, font size, browser zoom, the wrap
width the window gives the text column, whether `chat-window.tsx` is floating over it. And it
drifts *during* a presentation: nothing stops a third person inserting blocks above the
presenter's viewport, and every `y` below that point moves.

Shipped products split into two families here, and the split is about whether zoom is
available:

| | syncs | resolves different viewport shapes by |
| --- | --- | --- |
| Canvas (Figma observation mode, tldraw follow) | the viewport rectangle in canvas coordinates | **zoom** — tldraw: *"If aspect ratios differ, the system adjusts zoom to keep the followed user's content visible while maintaining the follower's viewport dimensions."* |
| Text (VS Code Live Share; Joplin and VS Code markdown preview for editor↔preview sync) | a **logical anchor plus a fraction** | not resolving it — the follower simply sees more or less context |

We are in the second row. Live Share's maintainers, asked for scroll sync directly: *"Due to
variations in screen resolution, font size, etc. we wouldn't actually synchronize scroll
position, but rather, visible ranges of text."* Their anchor is a line number. Ours is a block.

**The anchor is `{ blockId, ratio }`** — the block the presenter's viewport **top edge** sits
in, and a 0–1 fraction of that block's height. Both halves matter:

- `blockId` because `lib/blocks/types.ts` already promises "a uuid, stable for the block's
  whole life and independent of its position", and because `documentId + blockId` is already
  how this project points at a place in a document — that is exactly what the `block-link`
  block type stores, and what the SRS uses in UC-050/060/070. This is not a new coordinate
  system, it is the one we have.
- `ratio` because a block id alone is a coarse integer position. The fraction is the standard
  fix in the markdown-sync family (Joplin: linear interpolation between anchors, after
  observing that "the height of a Markdown text line is not always proportional to the height
  of the corresponding HTML element" — the same non-proportionality we have between two
  browsers).

### Why not three reference lines (top / middle / bottom)

This was the first idea and it is worth writing down why it was dropped, because it will occur
to the next person too. Pinning two lines at once over-constrains the follower: satisfying
both requires a third degree of freedom, and the only one available is scale. That is precisely
why the canvas tools can do it — zoom is free on a canvas — and precisely why we cannot: zoom
in a text document means the follower's font size changes with the presenter's window size.

And the three cases three lines were reaching for are all covered by the fraction alone:

1. **Snapping at block boundaries** — the fraction is continuous inside a block.
2. **A block taller than the viewport** (code, image, pdf — a presenter can be at the bottom
   of a three-screen code block). `ratio = 0.8` lands there exactly.
3. **The reference line falling in the gap between two blocks** — resolved by the anchor
   function, not by adding lines.

**The goal is "the same content in view", not "the same pixels".** Once that is the goal, a
taller viewport means more surrounding context, not a wrong position. Live Share calls this
"still optimizing for their personal views" and treats it as the point rather than a
compromise.

Top edge rather than the middle: it is what the markdown-sync family uses, it is where reading
starts, and it is one concept fewer. Changing it is a constant.

Sources, for whoever revisits this:
[Live Share #115](https://github.com/microsoft/live-share/issues/115) ·
[Live Share follow docs](https://learn.microsoft.com/en-us/visualstudio/liveshare/use/coedit-follow-focus-visual-studio-code) ·
[tldraw camera](https://tldraw.dev/sdk-features/camera) ·
[Joplin sync-scroll spec](https://joplinapp.org/help/dev/spec/sync_scroll/) ·
[Figma observation mode](https://help.figma.com/hc/en-us/articles/360040322673-Follow-along-with-observation-mode)

## Milestone 0 — the editor has no scroll container

Not part of this feature. Found while planning it, and everything else depends on it.

```tsx
// app/(workspace)/layout.tsx:105
<main className="min-w-0 flex-1 overflow-hidden bg-paper px-8 py-7">{children}</main>
```

`overflow-hidden`, and `editor.tsx` renders a plain `<div className="flex flex-col">`. **A
document taller than the window is clipped today and there is no way to reach the rest of it.**
Nobody has hit it because no test document has been long enough.

- **What**: the block list scrolls.
- **Files**: `app/(workspace)/layout.tsx`, `app/(workspace)/documents/[id]/editor.tsx`.
- **Reuse**: nothing — this is a `className` and a ref.
- **An explicit scroll element, not the window.** Both sides of the anchor math are measured
  against one box, and the shell already owns the page's full height (`min-h-full flex-1`), so
  a window scroll would mean the header and sidebar scrolling away with the text.
- **Done**: a document with 200 blocks can be scrolled to its last block.

## Milestone 1 — the anchor, as pure functions

- **What**: `scrollTop` ⇄ `{ blockId, ratio }`.
- **Files**: `lib/focus/anchor.ts`, `lib/focus/anchor.test.mts`.
- **Reuse**: no existing helper does this. The *shape* is borrowed from
  `lib/presence/roster.ts` — a pure function whose argument is shaped like what the caller
  already holds, so the rule can be tested with no browser and no running Yorkie.

```ts
type BlockBox = { id: BlockId; top: number; height: number };
export function anchorAt(boxes: Array<BlockBox>, scrollTop: number): FocusAnchor | null;
export function scrollTopFor(boxes: Array<BlockBox>, anchor: FocusAnchor): number | null;
```

Cases the tests have to pin down, because each one is a decision and not an edge case:

- **The line falls in the gap between two blocks.** Snap to the block below it — the reader's
  eye is going down the page, and rounding up never shows content the presenter has passed.
- **A block taller than the viewport.** `ratio` is measured against that block's own height,
  so this needs no special case; the test exists to prove it stays that way.
- **The anchor's block is gone** — deleted by someone else while the presentation runs.
  Returns `null`, and the follower holds still rather than jumping to the top.
- **No blocks at all.** `null`. A document that short has nothing to synchronize, which is
  also the whole answer to "what about an empty document".

## Milestone 2 — the anchor rides workspace presence

- **What**: a presenter's anchor is visible to everyone in the workspace.
- **Files**: `lib/presence/types.ts`, `app/(workspace)/presence-provider.tsx`.
- **Reuse**: the workspace document and its single Yorkie client, both already there. No new
  connection, no new document, no server route.

```ts
export type WorkspacePresence = WorkspaceMember & {
  presenting?: { documentId: string; blockId: BlockId; ratio: number } | null;
};
```

**On the workspace document, not on the presenter's content document.** Yorkie presence is
per-document, and UC-030 step 5 requires moving a follower who is *in a different document* to
the presenter's — put it on the content document and it is invisible to exactly the people who
need to see it. `WORKSPACE_DOC_KEY` exists for this class of workspace-wide fact already.

**FR-030-11 then costs nothing.** Presence is ephemeral: the presenter's tab closing, their
Wi-Fi dropping or the process dying all end the watch stream, Yorkie publishes `DocUnwatched`,
and the session is simply gone. A session record in `.data/` would instead need someone to
notice the presenter died and clean up after them. `presence-provider.tsx`'s own header note
already makes this argument for the roster; this is the same argument again.

**`null`, never `undefined`, to end a share.** Verified in the SDK: `toPresence`
(`node_modules/@yorkie-js/sdk/dist/yorkie-js-sdk.es.js:15989`) sends presence as
`map<string, string>` with each value `JSON.stringify`d, and `fromPresence` reads it back with
`JSON.parse`. `JSON.stringify(undefined)` is not a string, so an `undefined` never survives
the trip intact. `presence.set()` takes a partial, so setting this one key is all that is sent.

`presence-provider.tsx` keeps the workspace `Document` inside its effect today. It has to hold
it — a ref is enough — so `PresenceState` can expose `setPresenting(anchor | null)` beside the
`client` it already hands down, and so `rosterFrom` keeps working unchanged (it copies whole
presence objects, so the new field rides along for free).

- **Done**: one browser sets `presenting`; a second browser's roster shows it within a second,
  and it disappears when the first tab is closed.

## Milestone 3 — presenter and follower

- **What**: the buttons, and the scrolling.
- **Files**: `app/(workspace)/layout.tsx` (header), a new component beside
  `presence-stack.tsx`, `app/(workspace)/documents/[id]/editor.tsx`.
- **Reuse**: `useWorkspacePresence()` for both the roster and the new setter;
  `useRouter().push` for cross-document navigation, the same way `document-list.tsx` already
  navigates to a document.

**Where the controls live**: the header, next to `<PresenceStack />` (`layout.tsx:70-74`).
It is the one bar every screen in the group shares, and it is already where "who else is here"
is answered. When nobody is presenting it is a 공유하기 button; when someone else is, it
becomes "○○님이 공유 중 · 참여하기". That is FR-030-03 and FR-030-04 for the price of one
conditional, and it is why no toast is needed.

**Presenter side**: on the scroller's `scroll` event, coalesce with `requestAnimationFrame`
and publish only when the anchor actually changed. This is where the block anchor pays off a
second time — `blockId` changes a handful of times per screen rather than sixty times a
second, so the natural update rate is already low without a throttle to tune.

**Follower side**: on every change to the presenter's `presenting`, navigate if `documentId`
differs, otherwise `scrollTo({ top, behavior: "smooth" })`. Blocks need a `data-block-id` on
the wrapper `<div>` at `editor.tsx:611-617` — one attribute — so the element can be found from
an id.

### What shipping without the lock actually feels like

A follower who scrolls is pulled back by the presenter's next update. That is what "시점을
강제한다" means, so it is not wrong, but it will feel like fighting the page. The cheap fix,
if it grates in use: **the follower's own wheel or touch input ends the follow.** 종료 is in
scope already, so this is a listener and a call, not a new state — and it is the pattern Live
Share uses, where opening another file silently stops following rather than putting up a
dialog. Left out of the plan deliberately; add it after using the thing, not before.

- **Done**: see Acceptance.

## Acceptance

Unchecked — this is the plan, not the build.

- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [ ] A document longer than the window scrolls (milestone 0, and it is worth a look before
      anything else is built on it).
- [ ] Two browsers **at deliberately different window sizes**, one narrow enough to wrap the
      text differently: the follower stays on the same content as the presenter, and neither
      is scrolled to a place the other is not looking. This is the check the whole design
      exists for, so it is not run at one size.
- [ ] A follower sitting in a *different document* joins and is brought to the presenter's
      document at the presenter's position.
- [ ] The presenter scrolls through a block taller than the viewport and the follower tracks
      inside it, rather than jumping from its top to the next block's top.
- [ ] A third person inserts blocks above the presenter's position mid-presentation; the
      follower stays on the same content.
- [ ] The presenter closes their tab. Every follower is released, with no cleanup step.
- [ ] A follower presses 종료 and can scroll on their own; the presenter is unaffected and
      other followers keep following.

## Cut

Named so nobody re-adds them by accident.

- **A `.data/` session record.** Presence already ends the session on disconnect; a file would
  add a state that outlives the presenter and has to be reaped.
- **Zoom, or matching the presenter's viewport height.** The canvas answer. It means changing
  the follower's font size, and the whole design above is the argument against it.
- **A second reference line.** See "Why not three reference lines".
- **Cursor position as the anchor.** UC-030 is about 화면 위치, and a presenter who is talking
  rather than typing has a cursor parked somewhere irrelevant — or off screen entirely.
- **Multiple simultaneous presenters.** The presence field allows it structurally (it is
  per-member). The UI picks one and nothing here has to decide the rest.

## Cross-cutting

- **Requirements**: FR-030-01/04/05/07/09/11. FR-030-03 is met by the header affordance rather
  than a notification.
- **No SRS change.** UC-030 step 2 says 화면 위치 정보 and 스크롤 위치 정보; an anchor is an
  implementation of that, not a redefinition. `AGENTS.md` §5 rules out changing
  `docs/SRS-ko.md` alone in any case.
- **Roadmap**: `ROADMAP.md` Phase 3. Its exit criteria ("a presenter can drive every follower's
  view in real time") is met by this slice; the follower lock and presenter tools it also lists
  are not, and stay open.
- **Docs that go stale**: none yet. If the anchor rule outlives this task it belongs in
  `docs/design/`, written at the end rather than the start.
- **Groundwork for**: UC-040 (jump to another user's position) is the same anchor read from a
  different button — one member's position, jumped to once, instead of one member's position,
  followed continuously.

## Review

Filled in at the end.
