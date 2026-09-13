# Presence and Focus Following

- **Status**: Built. UC-030's thin slice (share → follow → end) is live; the rest of `lib/focus`
  and `lib/presence` supports it and the connected-user list.
- **Owns**: `lib/presence/`, `lib/focus/`, `app/(workspace)/presence-provider.tsx`,
  `app/(workspace)/presence-stack.tsx`, `app/(workspace)/focus-follow-provider.tsx`,
  `app/(workspace)/focus-share.tsx`, `app/(workspace)/documents/[id]/use-focus-presence.ts`,
  `app/(workspace)/documents/[id]/ink-overlay.tsx`.
- **Related**: [`docs/design/architecture.md`](architecture.md) §3(b) (presence over the client
  sync channel, not the WS hub); [`docs/SRS-ko.md`](../SRS-ko.md) FR-020-06/07/08, FR-030;
  [`docs/conventions.md`](../conventions.md) (the `simple:` marker convention this doc's source
  files use).

## Scope

Two related pieces of shared state, both riding the same mechanism for the same reason: **who is
here** (presence, the connected-user list) and **where they're looking** (focus, UC-030's
share/follow). Neither is covered by an existing design doc — `architecture.md` fixes that
presence lives on the client sync channel rather than the WS hub, but not why, or how focus
following reuses that same channel.

## Why presence rides Yorkie, not the WS hub

Yorkie already answers "who is attached right now" for any document — including the hard half of
that question, noticing when someone stops being attached, which is exactly the kind of liveness
tracking a hand-rolled heartbeat over the WS hub would have to reinvent. Riding it means the
roster is read straight off a document instead of being bookkept by a second system that could
disagree with the first about who's actually connected.

That needs a document to attach to, and Yorkie presence is scoped per-document — so a
workspace-wide roster needs a workspace-wide document to hang it on. `WORKSPACE_DOC_KEY` names a
reserved document, `"workspace"`, that every client in a workspace attaches to purely to be
counted present. It carries no content and is never edited; an empty document is the cheapest
thing Yorkie will let a client be present on. The literal key follows the same shape
`docs/design/api.md` §2 already gives the `chat` singleton — a real document's key is its id, and
both singletons predate any id to reuse. It has to be a legal Yorkie key (`a-z A-Z 0-9 - . _ ~`
only), which nine lowercase letters trivially satisfies.

## What gets published: `WorkspacePresence`

Deliberately the same `WorkspaceMember` shape the session registry mints at join, extended with
one field. Reusing it rather than defining a second identity type means there's only one place
the roster's color tag can disagree with the join-time color — and `FR-020-08` promises that
color stays the same member's color across their devices, so a second identity type would just be
a second chance to get that wrong.

The extension is `presenting`: set while a member is sharing their view, cleared with `null`
(not `undefined`) when the share ends, and absent entirely for a member who has never presented.
`null`, not `undefined`, because the Yorkie SDK `JSON.stringify`s every presence value before
sending it — `undefined` does not survive that round trip, so a field meant to signal "no longer
sharing" has to use a value the wire format can actually carry.

## Two subscriptions, not one

`others` covers watched, unwatched, and a peer changing their own presence. It does **not** cover
this browser's own — Yorkie routes a client's own presence changes through a separate
`'my-presence'` channel. Subscribing to `others` alone means `setPresenting` (the share and end
buttons in `FocusShare`) publishes correctly for everyone else and never updates the local
`members`, leaving the presenter's own header stuck showing the share as never having started.

Found by testing the presenter's own button, not by reading the SDK first.

Both subscriptions are opened **before** the first read, so an arrival between the two is not
missed.

## The roster collapses clients into members

Yorkie counts **clients**, and one member can hold several at once — two browser tabs, or the
moment during a takeover (FR-020-08) when the displaced device has not finished detaching.
Measured against a real server, a member with two tabs open appears twice in `getPresences()`, so
`lib/presence/roster.ts` folding them by `id` is what the roster is *for*, not a precaution.

It drops any presence without an `id` rather than rendering it. `undefined` as a `Map` key would
collapse every such entry into one blank row, and this is not hypothetical: Yorkie runs with no
auth webhook today (`api.md` §2), so a client can attach with a presence shape of its own.

The function is kept out of the component so it can be tested without a browser or a running
Yorkie, and takes the shape `doc.getPresences()` returns so the caller can hand its result
straight over.

## The host has no session

The host proves themselves with the bootstrap secret (`lib/host-secret.ts`) and never fills in a
join form, so there's no `WorkspaceMember` for them — without `HOST_PRESENCE`, the host would be
the one person missing from the roster they're supposed to administer (`UC-011` kicks guests from
this exact list). It uses a fixed id, `"host"`, where guests get a fresh `randomUUID()` each —
one host per container, so the two id spaces can't collide. The color is a neutral gray chosen to
not look like any of the eight rotating guest tags, and to stay legible on both light and dark
paper, which rules out the obvious near-black.

## The one connection, and what it is told

**Attaching to the workspace document *is* being present.** Yorkie publishes `DocWatched` to the
other clients when a client attaches and `DocUnwatched` when the watch stream ends — a clean
detach, a closed tab, or Wi-Fi dropping, all the same. Nothing polls and nothing has to notice a
disconnect, which is the half of liveness a hand-rolled heartbeat gets wrong.

That connection is owned by a provider rather than by whichever component draws the roster. Two
components each opening a `yorkie.Client` would be two connections per browser, and a per-page
component would detach and re-attach on every navigation inside the workspace — everyone else
would watch that person leave and rejoin. Identity reaches it as three strings rather than one
member object, because a fresh object each render would rebuild the connection each render.

**The Yorkie address defaults to the page's own URL, not a server-computed one.** Whatever host
someone typed to reach the app is by definition one they can reach. Handing every client the LAN
address instead is what broke this on desktop: a page opened at `localhost:3000` was told to
fetch `192.168.x.x:8080`, and Chrome, Brave and Firefox all refused to leave the loopback address
space — while a phone, already on the LAN address, connected fine.

The one escape from that default is `YORKIE_PUBLIC_ADDR`, for a Yorkie that genuinely runs on a
different machine than this app — a case the page's own URL cannot answer, so an explicit
override is the only option.

**A token fetch that fails returns an empty string rather than throwing.** Yorkie refuses an empty
token, which surfaces as the workspace saying it is disconnected. Throwing instead would reject
inside the SDK's own retry path, where no component can render it.

**"Am I presenting" is local state, not read back from the roster.** This browser's own row does
come back through Yorkie's `'my-presence'` channel, but reading it there would make `members`
change on every one of this browser's own publishes — which is exactly what made the presenter's
scroll-publish effect tear down and rebuild its scroll listener on every scroll while presenting.
`followingId` is local for the same reason.

## Focus: what travels is an anchor, not a scroll position

`FocusAnchor` is `{ blockId, ratio }` — the block whose range contains the viewport's top edge,
and how far into it. Not a raw `scrollTop`, because `scrollTop` isn't a shared coordinate between
two browsers: different window heights, different font rendering, different zoom all put the same
logical position at different pixel offsets. A block id plus a fraction of that block's own
height is the same "where" regardless of any of that.

`anchorAt` (`lib/focus/anchor.ts`) resolves a `scrollTop` to an anchor in one pass down the
block boxes, in render order — sufficient because a `scrollTop` before a box's own `top` is
always either before the very first box, or past the previous box's bottom (nothing else is
possible, or the function would already have returned inside that earlier box). Both cases
resolve to the block below, at `ratio: 0`: the decided behavior for a scroll landing in a gap
between blocks is to round toward the direction the reader's eye is moving, since rounding up
would show content the presenter has already scrolled past.

The ratio is quantized to 1% of the block's own height on the way out (`clampRatio`), not for its
own sake but so the presenter's "has the anchor actually moved?" check has something that can
ever be equal across two reads — against a raw float it never would, since the fraction changes
on every scrolled pixel. This bounds nothing about how fast a scroll appears to a follower; that
cadence is `PUBLISH_MS`'s job. The rounding stays correct only as long as 1% of a block is well
below what a follower can perceive as movement — worth revisiting if a block ever gets tall
enough for that to stop holding.

`readBoxes` (`lib/focus/dom.ts`) is the only place this data touches the DOM: it reads each
rendered block's extent in `container`'s own coordinate space, which has to be the same space
`container.scrollTop` is measured in for the two to compose. That requires `container` to be a
*positioned* ancestor of the block elements — without it, `offsetTop` resolves against whichever
further-out ancestor becomes each block's actual `offsetParent`, which does not line up with
`container.scrollTop` at all. The editor's own scroll container carries `relative` for exactly
this reason.

`documentIdFromPathname` (`lib/focus/pathname.ts`) is kept as a plain function, split out of
`focus-follow-provider.tsx`, so the pathname-to-document-id parsing can be tested as a pure unit
without needing to render the client component around it.

## What the two focus effects may depend on

The presenter effect and the follower effect sit next to each other and have **opposite**
dependency rules. Both were arrived at by measurement, and both look like mistakes until the
reason is written down.

**The presenter effect must not depend on `blocks`.** It depends on `blocksLoaded`, a boolean that
flips once. The scroll container does not exist while `blocks` is still `null`, so the effect
needs one more chance when loading finishes — but `blocks` is a fresh array on every recompute,
and depending on it tore the scroll listener down and rebuilt it continuously. A native `scroll`
event landing in that gap is dropped, which is exactly what made following work sometimes and not
others. Nothing in the effect reads `blocks` anyway: `readBoxes` measures the live DOM at publish
time.

**The follower effect must depend on `blocks`.** A third person inserting blocks above the
presenter moves every box's `top` without the anchor's own `blockId` or `ratio` changing at all.
Only recomputing against fresh boxes keeps the follower on the same content through that, and it
is in the acceptance list.

For the same reason the follower's effects depend on the anchor **pulled apart into primitives**,
not on `members` — `rosterFrom` rebuilds that array on every presence event, and an anchor that
has not moved should not re-run anything.

`isPresenting` is local state rather than read back off `members`, or the presenter effect would
re-run on every publish.

### Wall clock, not `requestAnimationFrame`

rAF bounds publishing to the display's refresh rate, which is not a network cadence — blocks are
short enough that the anchor changes every couple of frames, so roughly sixty presence writes a
second would go out. A pending timer is left alone rather than pushed back: it reads `scrollTop`
when it fires, which makes it the trailing edge.

The anchor is published **once up front**, not only on the next scroll. Otherwise starting a share
— or presenting into a freshly opened document — would leave the previous anchor standing until
this browser happened to scroll.

When there is nothing to follow, the last commanded position is **forgotten** along with it. It
exists only to stop the same target being re-issued, and holding it across a pause would swallow
the first scroll after rejoining a presenter who never moved.

## Tearing down mid-flight is what #32 was

`deactivate()` is a no-op on a client that is still activating, so a cleanup that runs mid-flight
returns immediately while the chain behind it goes on to attach and start a watch stream. That
leaves the browser present in everyone else's roster with nothing pointing at it.

Two guards follow: the cleanup returns immediately if `activate()` has not settled, and teardown
runs only once setup has. `detach` on the client releases **every** document it holds, including
any content document the block editor attached through it, which is what tells the other browsers
to drop this member.

## The follower must not re-issue a scroll target

`scrollTo({ behavior: "smooth" })` **aborts an in-flight smooth scroll and restarts its easing
curve from wherever it had reached.** Re-issuing the same target faster than the animation
completes therefore leaves the follower creeping and never arriving — measured, and it reads as
"it just doesn't follow" while the effect fires correctly every time.

So the follower remembers the last target it *commanded* and skips an unchanged one. That memory
cannot be `scrollTop`: that reads where the animation currently *is*, not where it was told to go.

The publish side is rate-limited to ten anchors a second — `simple:` a plain interval, no easing
or adaptive cadence. That is well under what a follower perceives as lag, since their side scrolls
smoothly between anchors anyway, and it is six times fewer writes than the display's frame rate.

## Why focus following is its own provider, not folded into presence

`FocusFollowProvider` sits beside `PresenceProvider`, not inside it, because *who I am following*
and *who is present* are unrelated pieces of state that only happen to want the same roster to
check themselves against. Presence is shared workspace state, published to every client; who is
following whom is purely local UI state that is never published — folding the two together would
make it easy to accidentally leak the second into the first.

The provider also owns the one side effect that has to run regardless of which page happens to be
showing: crossing to the presenter's document on join (`FR-030-05`). `editor.tsx` only ever mounts
once already on a `/documents/[id]` route, so if that navigation lived there instead, clicking
참여하기 from the document list — no editor mounted at all yet — would set `followingId` and
nothing would be there to act on it.

`followingId` itself is settled during render rather than from an effect (`FR-030-11`, and the
same rule when a presenter ends their own share): once the followed member is gone from the
roster, or has stopped presenting, there is nothing left to follow. Neither ending fires an event
of its own to react to — presence simply stops carrying `presenting`, or stops carrying the
member at all — and the roster being checked against is already in hand during this render, so an
effect would only force a second render to reach the same answer. The stored id is *forgotten*,
not merely derived away, because leaving it standing would let the same presenter's next share
pull every browser that once followed them back in with no 참여하기 pressed.

## `FocusShare`'s states

It lives in the header beside `PresenceStack`, not as a toast: sharing is a state a person is *in*, and a control that shows the current state has to stay on screen rather than announce a transition and leave.

One control, checked in an order that assumes a member is never simultaneously presenting and
following: presenting → 종료 my own share; following someone → end that follow; more than one
other member presenting → a dropdown of them plus 참여하기; exactly one other member presenting →
참여하기 for that one; otherwise → 공유하기.

The dropdown exists because nothing in FR-030 or the roster limits presenting to one member at a
time — `presenting` is a plain per-member flag, and the roster is a flat list. Picking just the
first match (the original shape, `members.find(...)`) left every presenter past the first
completely undiscoverable, on any page, to anyone — not an error (the dashboard never reads
presence state at all, so nothing could throw), a silent gap: `.find()`'s "first" is whichever
order Yorkie's own roster happens to iterate in, not "most recent" or "most relevant to what I'm
looking at." `docs/ui/app-shell/app-shell.jsx` already sketches a fuller "다중 발표자" card-grid for
this; the dropdown is the minimum that makes every presenter reachable, not that design.

The selection is settled during render, the same way `followingId` is in
`focus-follow-provider.tsx`: a presenter the dropdown was pointed at ending their share is
detected by checking whether the picked id is still in the list, falling back to whichever
presenter is first, rather than needing an effect to notice and correct a stale selection.

The 공유하기 button is hidden outside a document — `FR-030-01`'s context ("발표자가 바라보고 있는
문서로 시점을 고정시킨다") has no view to anchor a share to on the dashboard or anywhere else in
the shell that isn't a document, so there is nothing valid for it to do there.

It used to stay visible-but-disabled instead, on the theory that hiding it would make the control
pop in and out of the header on every navigation. That theory doesn't hold given what the shell
actually has today: the workspace only has one other route shape (the dashboard) to pop in and
out against, not the many the theory pictured — the other sidebar items (Members, Storage,
Settings) are still unbuilt. Revisited directly rather than kept on a guess.

Starting a share reads the current anchor straight off the live DOM at the moment of the click,
rather than threading it down through context continuously — the anchor is only needed once, at
that moment, and a `null` read (the editor for this route hasn't finished mounting) is rare and
self-resolves: nothing happens, and pressing the button again a moment later works. Marked
`simple:` in the source for exactly this tradeoff.

## The ink layer

UC-030's presenter tools (FR-030-12/13/14, issue #95): a presenter drags over the document and
every follower sees the mark land on the same block. The whole feature is one SVG overlay, one
pure module (`lib/focus/ink.ts`) and three optional keys on a presence type that already existed.

**The anchor argument extends to ink unchanged.** "What travels is an anchor, not a scroll
position" is above; every word of it holds for a drawn mark, and for the same reason — a follower's
window reflows the document, so a container-space pixel means something different on each machine.
An ink point is therefore `FocusAnchor & { x }`, which is not a convenience: being structurally a
`FocusAnchor` is what lets `scrollTopFor` decode it with no adapter, and lets `anchorAt` resolve the
vertical half with no second copy of the gap rule, the before-the-first rule, or the past-the-last
clamp.

What that buys and what it does not: the **block** is exact everywhere, and a mark survives either
side scrolling, a third person inserting blocks above it, and any difference in window height. What
it does not survive is a block that wraps to a different number of lines, where a ratio can land
between two lines. That is inherent to anchoring by ratio; the fix would be character-offset
anchoring, which a bare `<textarea>` cannot support without a mirror layer replicating its font
metrics — rejected in #95 with that reasoning, not forgotten.

### Why x is measured against the block, not the container

The scroll container carries `-ml-4 pl-4` — load-bearing for the drag handle, which is why it
cannot simply be dropped. That padding puts a block's `offsetLeft` at 16 while an absolutely
positioned overlay's `left: 0` sits at the padding box edge, and `clientWidth` and
`getBoundingClientRect().width` disagree by a scrollbar. Measuring `x` as a fraction of the
block's **own** box sidesteps all three: `offsetLeft`/`offsetWidth` are in exactly the space
`offsetTop`/`offsetHeight` already are, so the two axes compose by construction rather than by
arithmetic that has to be kept in step.

That is what `readBoxes` widened for. `InkBox` is `BlockBox` plus the horizontal half, and
`Array<InkBox>` satisfies every `Array<BlockBox>` parameter, so the scroll-anchor callers did not
change at all.

### Two quantizations, for two different reasons

`anchorAt` rounds a ratio to 1% of its block. That figure exists so the presenter's "has the anchor
actually moved?" check can ever match — against a raw float it never would. Ink has no such check,
and 1% of a tall code block is visible jitter, so ink passes a finer `steps`.

Ink still rounds, for a reason the scroll anchor does not have: **Yorkie presence has no delta.**
`Presence.set` merges the partial into the local presence and then transmits `deepcopy` of the
whole object, and the receiver replaces its entry wholesale. Splitting ink into its own presence
*key* therefore saves nothing; the only lever is keeping the object that gets re-sent small, which
makes a short number worth having.

That same fact cuts the other way and is worth stating plainly: `publishActiveBlock` and the 5s
occupancy heartbeat retransmit the marks too. At one write per focus change and one per five
seconds, with the caps below in place, that is the *cold* price of the channel. The *hot* price —
while a stroke is actively being drawn — is its own section, next.

### A mark is a path, not a rectangle — and what that costs

A drag's two endpoints once made a rectangular band per block crossed. A presenter now draws
freehand, so a mark is an ordered path:

```ts
type MarkPoint = Omit<InkPoint, "blockId">;
type InkSegment = { blockId: BlockId; points: Array<MarkPoint> };
type Mark = { kind: MarkKind; segments: Array<InkSegment> };
```

Segments, not one flat `Array<InkPoint>` — measured, not guessed, with real
`JSON.stringify`/`Buffer.byteLength` against `newBlockId()`'s actual 36-character shape:

| points in one block | flat (`blockId` on every point) | segmented (`blockId` once) | saved |
|---:|---:|---:|---:|
| 50 | 3,881 B | 1,495 B | 61% |
| 150 | 11,581 B | 4,295 B | 63% |
| 300 | 23,131 B | 8,495 B | 63% |

Most strokes stay inside one or two blocks, which is exactly where a flat encoding pays the
36-byte `blockId` tax on every single point. Grouping consecutive same-block points into one
segment is one rule — append to the last segment if the new point's block matches, else start a
new one — for a 61–63% cut in the payload this feature makes hot. Given presence has no delta,
that is the minimum code that solves the problem, not an unrequested abstraction.

Two caps follow, each with a stated basis rather than a round number:

- **`MIN_POINT_DISTANCE_PX = 2`** — a candidate point is kept only once it has moved this far from
  the last accepted one, in raw pixels (not ratio — a ratio lives in one block's own scale and
  isn't a physical distance comparable across blocks). The figure follows the precedent issue #95
  already cites, Yorkie's own cursors example, which thins at the same 2px.
- **`MAX_POINTS_PER_MARK = 300`** — `MARK_CAP` bounds how many marks a member may hold, but never
  looked inside one, and a mark is no longer the fixed ~110-byte shape it was sized against. 300
  points measures to 8,495B segmented — at least 600px of accepted travel at the 2px floor, already
  several paragraph-widths past what an underline or highlight gesture needs. Past the cap,
  extending a mark is a no-op: the stroke freezes rather than losing its start, which would be more
  code and would move where the stroke appears to begin. Worst case, every one of `MARK_CAP`'s 16
  marks at this cap: 16 × 8,495B ≈ 133KB, up from ~1.8KB when a mark was a fixed rectangle — not
  shrunk further, because reaching it needs 16 uncleared 300-point strokes left standing at once,
  far outside real annotation use, and it costs bandwidth only for as long as that state persists,
  not a recurring per-second charge on top of what's below.

### Streaming a stroke: throttled while drawing, immediate at the moments that matter

A follower watches a stroke form, not only its finished shape, so the presenter's browser has to
publish mid-drag. `PUBLISH_MS` — the scroll anchor's own trailing-edge throttle constant — is
exported from `use-focus-presence.ts` and reused here rather than defined a second time at the
same value: one throttle idiom, one source of truth for its cadence.

The old code published on every change to the presenter's own `mine` state, in a plain effect —
correct when a mark only ever changed once, on release, and wrong the moment a mark can change
many times a second while a stroke is drawn. It is replaced by explicit calls at the four moments
that actually need different rules:

- **starting a stroke** publishes immediately — once up front, not only on the next move, the same
  rule the scroll anchor's own presenter effect already follows.
- **extending a stroke** schedules the throttled publish, which reads the *current* stroke through
  a ref at fire time rather than whatever it closed over when scheduled — the same reason the
  scroll anchor's effect re-reads `container.scrollTop` live instead of capturing it.
- **releasing the pointer** cancels any pending timer and publishes the final state immediately,
  unthrottled. Without this, points accepted after the last throttle tick would sit unsent until a
  tick that, since the drag just ended, may never come.
- **지우기 and ending the share** were never on the throttle path to begin with — a direct call and
  a small effect, respectively, both unconditional.

A follower who attaches mid-stroke needs no special case: presence carries full current state on
every write (no delta, again), so whatever the presenter's last publish sent — in-progress points
included — is exactly what a newly-attached follower's first read returns, the same way a follower
joining mid-scroll already sees the presenter's current anchor rather than nothing.

A stroke crossing a block boundary can show a small seam where its two segments meet, since each
decodes independently against its own block's boxes — the same accepted "sub-block drift"
limitation as the scroll anchor's own ratio, not a bug worth chasing.

### Ink is read where it is drawn

`useBlockDocument` already subscribes to the content document's `others` channel for block
occupancy. The overlay opens a **second** subscription on that same channel rather than adding a
branch to the first, and the reason is not tidiness: the existing callback ends in
`setOccupantByBlock`, state that lives in `useBlockDocument` and therefore re-renders the whole
editor. `TextBlockView` is a plain function, not `memo`, so routing ink through there would
re-render every textarea in the document each time a mark arrives. Owning the state in the overlay
confines that to one `<svg>`. Yorkie allows several subscribers on one document; this is not a
second connection.

The visibility gate lives in `inkFrom` rather than in the transport, because presence reaches every
attached client either way — marks are published to the document, and *who may draw them* is a
rendering decision. `followingId === null` returning `null` is the whole of "a non-follower with the
document open sees nothing" (FR-030-13), which is why it is a unit test rather than a manual check.

### The presenter's own marks are local state, and that is not two owners

The rule is already above for `isPresenting`: reading your own published state back re-renders on
every publish, and that is the bug that tore the scroll listener down. Marks follow it.

This reads like `docs/conventions.md`'s S-2 — one fact in two places — and is not. S-2 is about two
places both *read* as the current value, kept in step by two write paths. Here there is one write
path, and the browser that writes the presence copy never reads it: on the drawing machine local
state is the owner and the published copy is a projection sent outward; on a receiving machine the
received presence is the only owner. The failure S-2 describes — the UI showing one thing while the
data says another — has nowhere to occur.

Ending a share is settled during render, not in an effect, the same way a follow that has stopped
is settled in `focus-follow-provider.tsx`: the answer is already in hand, and an effect would only
force a second render to reach it.

### Where the overlay sits

Last child of the scroll container, for two reasons that are easy to lose. **Paint order**: at equal
`z-index` later DOM order wins, which is how pen mode covers `text-block.tsx`'s `z-20` slash menu
without claiming the `z-30` the editor's modals use. **Effect order**: sibling effects run in DOM
order, so measuring last means measuring after every textarea in that commit has auto-grown.

Its height is the bottom of the last measured box. `inset-0` would give the visible box and clip
every mark past the first screen; `scrollHeight` over-reports, because the 파일 추가 footer and its
`flex-1` sit below the last block.

The overlay is not optional, and this is the one place the editor's own design constrains the
feature: every block's editing surface is a bare `<textarea>`, so a pointerdown on a block moves the
caret. Something has to be on top to take the drag instead. With no tool selected it drops back to
`pointer-events: none`, so a follower's standing marks never eat a click.

### The pointer needed no capture mechanism of its own

FR-030-12's other half: a dot that shows where the presenter is pointing, fading a couple seconds
after it stops moving — for gesturing while talking, not for leaving a mark. The natural worry is
that it needs its own input-handling architecture, since underline/highlight need the SVG to
*capture* pointer events (a bare `<textarea>` would otherwise take the caret on the first click of a
drag). A pointer has no drag to protect.

That worry turns out to be moot once one product decision is made: **while the pointer tool is
selected, the presenter is read-only** — clicking or typing is blocked, exactly like the two drawing
tools already are. Once that's true, the SVG's existing capture (`z-20 touch-none` while *any* tool
is selected, unchanged since underline/highlight) already blocks the click underneath for free — the
pointer tool doesn't need a reason of its own to be `z-20`, it inherits one. So the pointer is a third
branch on the handlers that already exist, not a parallel architecture: `onPointerDown` gains one
line (the pointer tool never starts a mark), and `onPointerMove` gains a branch that publishes a
position instead of extending a stroke. `onPointerUp`/`onPointerCancel` need no changes at all —
both already guard on `drawingRef.current`, which the pointer tool never touches.

A pointer position is an `InkPoint`, decoded and rendered with the exact functions marks already use
(`inkPointAt`, `inkPixelsFor`) — anchoring by block is exactly as necessary here as it is for a mark:
a follower's window can be a different width than the presenter's, and a raw pixel would land
somewhere else entirely.

### Only the current point is ever sent — the trail is local

Unlike a mark, a pointer position is never accumulated before it's published — each `onPointerMove`
that clears `shouldAcceptPoint`'s thinning floor overwrites `pointerRef.current` and republishes the
single current point, throttled by the same `schedulePublish`/`PUBLISH_MS` marks already use. The
payload is therefore constant-size regardless of how long or how fast the presenter has been moving,
which is the one thing that would have made a fading trail expensive to publish.

The trail a follower sees is built entirely on their own side: each arriving point is stamped with
`Date.now()` *at arrival* and appended to a local buffer, aged out past `TRAIL_MS` (2,500ms, the
middle of #95's own "~2-3s"). No clock sync between machines is needed, because nothing timestamped
by the sender is ever transmitted — a receiver's trail is simply "what I have received in the last
`TRAIL_MS`," which is also self-healing across a stall: a receiver that hears nothing for a few
seconds just has an empty trail, no reconciliation required.

Aging happens on arrival *and* on a plain interval (matching `PUBLISH_MS`'s own precedent — no
easing, no adaptive cadence) — a trail also has to fade when the presenter has simply stopped moving,
which a purely arrival-triggered prune would never catch. `pruneTrail` returns the same array
reference when nothing ages out, so an idle tick over an unchanged trail re-renders nothing.

Rendering ages, so it needs a wall-clock value — and a component's render has to stay pure, which
rules out calling `Date.now()` inside one. `now` is state in the parent, updated on the same prune
interval, passed down as a prop rather than read fresh inside the leaf that uses it.

Only the most recent point additionally eases toward its position with a CSS `transform` transition
(`PUBLISH_MS` in duration) rather than snapping — the same reasoning already on record for the scroll
anchor's own follower: regenerating the whole trail's geometry every frame to smooth a curve that 25
points over 2.5 seconds already renders as continuous would spend a 60Hz render on nothing visible.
Smoothing only the head, which is the one point that visibly jumps between 10Hz network ticks, is
where the payoff actually is.

The presenter never renders their own dot — their OS cursor already shows where they are; drawing an
extra one under it would be redundant, not merely unnecessary.

### The pointer's cost was checked against marks becoming paths, not assumed

`MAX_POINTS_PER_MARK`'s own comment already prices a member's marks at up to ~125KB in the
worst case, and that number didn't exist when #95 first reasoned "publish only the current point
keeps the pointer's own payload O(1)" — marks were still a fixed ~110-byte rectangle then. Since
presence has no delta, the pointer's own small payload rides alongside whatever `marks` currently
are on *every* publish, and the pointer publishes far more often (continuously, while selected) than
the occasional focus-change or 5-second heartbeat that used to be the only things re-sending marks.
Measured, not assumed:

| scenario | payload/publish | at 10Hz |
|---|---:|---:|
| pointer field alone | 88 B | ~0.9 KB/s |
| realistic marks (3 typical strokes) + pointer | ~1.9 KB | ~19 KB/s |
| worst-case marks (16 maxed 300-point strokes) + pointer | ~125 KB | ~1.25 MB/s |

The realistic case is trivial on a LAN. The worst case is unchanged in kind from what was already
accepted — it needs 16 uncleared maximum-length strokes standing at once, and the pointer adds 88
bytes to that ceiling, not a materially new one. No caps changed here; this confirms the existing
ones still hold rather than deciding anything new.
