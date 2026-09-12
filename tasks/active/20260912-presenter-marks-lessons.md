# Presenter marks — lessons

**Created**: 2026-09-12

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **Yorkie presence has no delta.** `Presence.set` reads as a partial update and the type says
  `Partial<P>`, but the implementation merges into the local presence and then transmits
  `deepcopy(this.presence)` — the whole object — and the receiver replaces its entry wholesale. This
  cost a wrong design decision mid-discussion ("split ink into its own presence *key* so scroll
  publishes stop re-sending it"), which is only false because of this. The real lever is splitting by
  **document**, and keeping the re-sent object small.
- **That cuts both ways and we kept it.** Because `set` merges, the overlay can publish its own `id`
  without `use-block-document.ts` learning anything — which removed a whole file from the diff. The
  same mechanism that broke the key-splitting idea is what made the id free.
- **`BlockPresence` had no member id**, so a follower could not tell the presenter's ink from anyone
  else's. Not visible from the design; only from trying to write the visibility gate.
- **The scroll container's `pl-4` puts the overlay's origin 16px off the blocks'.** Measuring `x`
  against each block's own `offsetLeft`/`offsetWidth` sidesteps it, the scrollbar disagreement
  between `clientWidth` and `getBoundingClientRect().width`, and the padding arithmetic all at once.
  Widening `readBoxes`'s return type cost nothing: `Array<InkBox>` already satisfies every
  `Array<BlockBox>` parameter, so no scroll-anchor caller changed.
- **ESLint caught a real bug as a style rule.** `setState` inside an effect to clear marks when a
  share ends was flagged by `react-hooks/set-state-in-effect`. The fix — settling during render —
  was already the repo's own pattern in `focus-follow-provider.tsx`, and it is *better*: the clear
  now publishes in the same pass instead of a render later.
- **A derived value beat a second piece of state.** A tool left selected when a share ended would
  have left the overlay capturing pointer events over a document nobody could edit. Found by reading,
  not by running. `tool = isPresenting ? picked : null` is the whole fix.

## Milestone 3 revision: straight lines → freehand strokes

Manual browser testing of the straight-line version worked exactly as designed — and immediately
showed the design was too narrow. A straight line between two drag endpoints can't circle a
diagram or underline a curve of text; real annotation is freehand. This is the loop
`docs/testing.md`/the task template are actually for: build, run it for real, let the real thing
tell you what the design missed, before the PR ever opens.

- **The rectangle-band model wasn't salvageable, it was replaced.** `marksAcross`'s whole job was
  turning two endpoints into per-block corners. A freehand path has no two endpoints to speak
  of — the fix was deleting `marksAcross`/`markRect` outright, not extending them.
- **Segmenting by block turned out to be the "minimum code" answer, not a shortcut.** A flat
  `Array<InkPoint>` (a `blockId` on every point) looked simpler to write. Measuring it first —
  actual `JSON.stringify`/`Buffer.byteLength`, not an estimate — showed segments (group consecutive
  same-block points, carry `blockId` once per run) cut the wire size 61–63% at every length
  tested, because most strokes never leave one or two blocks. The "simpler" flat code would have
  been the wrong rung: less code for a materially worse number, on the exact payload this feature
  makes hot.
- **`MARK_CAP` quietly stopped meaning what its own comment said.** It was sized against a mark
  that could only ever be ~110 bytes. Once a mark became an open path, the count it capped stopped
  bounding the payload at all — nothing about `capMarks` itself was wrong, its *premise* had
  expired. The fix was a second, independent cap (`MAX_POINTS_PER_MARK`) rather than trying to make
  one number do both jobs.
- **Two different lint rules for two different rules of thumb, and conflating them cost a
  rewrite.** `react-hooks/refs` (no ref writes during render) and `react-hooks/set-state-in-effect`
  (no direct `setState` in an effect body) both fired on the same few lines in sequence, and the
  fix for one looked like it should also fix the other. It didn't: the working shape splits them —
  state resets stay in the render-time "settle during render" pattern this file already used for
  `mine`, and ref resets plus the `doc.update` move into a *separate* effect that contains no
  `setState` at all. One effect trying to do both jobs is what tripped both rules.
- **Real-time streaming needs a fact the old effect-per-`mine`-change code got for free by
  accident: an explicit unthrottled flush on release.** With publishing throttled during a drag,
  points accepted after the last tick would otherwise sit unsent until a tick that, since the drag
  just ended, may never come. Cancelling the pending timer and publishing immediately on
  `pointerup` is not an optimization, it's what makes the last few pixels of every stroke actually
  arrive.

## Milestone 3, second fix: strokes breaking up mid-draw

Manual testing of the freehand revision surfaced a new symptom: the drawn curve looked broken in
chunks. The user's own hypothesis — publish more often — was a reasonable guess, and one question
disproved it in a single step: **does it happen on your own screen too?** Yes. Local rendering
never goes through `PUBLISH_MS` or the network at all, so a network-frequency fix could not have
been the cause, and building it (raising the publish rate, or worse, adding interpolation
speculatively) would have shipped complexity that fixed nothing.

The actual cause: `onPointerDown`/`onPointerMove` called `readBoxes(container)` — a full DOM
re-query plus a layout read on every block — on **every accepted point**, up to hundreds of times a
second during a fast drag. `boxes` was already sitting in component state, refreshed only when
`blocks` changes, and nobody edits mid-drag — the handlers were paying for a fresh read of data
they already had. Swapping `readBoxes(container)` for the existing `boxes` state was the entire fix:
zero new code, no test changes, no behavior change to what's computed.

**The lesson**: when a symptom could have two very different causes (network vs. local), find the
one question that tells them apart before touching any code. "Does your own screen show it too" cost
nothing and eliminated an entire wrong branch of investigation — and the user's own reasonable guess
would have added cost (a shorter throttle) without fixing anything, which is the failure mode
`docs/conventions.md`'s S-4/S-5 pattern exists to catch: a plausible-sounding fix that was never
checked against what was actually expensive.

## Milestone 3, third fix: drawing broken in the block right after an image

Reported as "drawing doesn't work, and there's an error, in the block right below an image."
`image-block.tsx`'s `<img>` has no intrinsic `width`/`height`, so it renders small until it loads,
then reflows the page — pushing every block below it down. `boxes` was only re-measured when the
*block list* changed, and an image finishing its load doesn't change that list at all, so `boxes`
kept the pre-load positions indefinitely: every block after an image was measured at the wrong
`top`, so a click there anchored against stale geometry.

This is exactly the gap the original design doc flagged and deferred: "no `ResizeObserver`... a
presenter who resizes their window mid-share leaves ink stale... four lines to add if anyone
notices." Someone noticed — an async image load, not a window resize, but the same missing
mechanism. The fix is a `ResizeObserver` watching every current block, re-measuring on any size
change, set up and torn down in the same effect that already re-measures on `blocks` changing.

**The lesson**: a deferred limitation, correctly reasoned and explicitly written down at the time,
is still a limitation — writing it down is what made it a five-minute fix instead of a fresh
investigation once it was actually hit. It's also a nice case of one mechanism covering two
motivations at once: the same observer that fixes async image loads also removes the smaller,
previously-accepted drift from a block auto-growing while someone types above the draw — that
tradeoff's now gone too, not because it was re-litigated, but because the fix for the reported bug
happened to subsume it.

## What we would do differently

- Read the SDK implementation before reasoning about presence cost, not after. Two of the six
  surprises above are the same mistake: trusting a type signature or a doc comment about what goes on
  the wire.
- The mark shape went through two drafts. The first nested two `InkPoint`s, each carrying its own
  `blockId` — double the payload for a pair that is always in the same block, with the invariant
  enforced only by a comment. Flattening to one `blockId` plus four numbers made the invariant
  impossible to violate.

## Worth extracting

- **`docs/conventions.md` candidate**: "a projection is not a mirror." The presenter's marks live in
  local state and are published outward; that reads like S-2 (two owners for one fact) and is not,
  because the browser that writes the presence copy never reads it. S-2's own test — a UI showing X
  while the data says Y — cannot occur when nothing reads the outbound copy. This is now argued in
  `presence-and-focus.md`, and it is the second time the same shape has come up (`isPresenting` was
  the first), which is the bar for promoting it.
- **Note for PR 2 (the fading laser pointer), updated**: `MARK_CAP`'s worst case moved from ~1.8KB
  to ~133KB once marks became open paths (`MAX_POINTS_PER_MARK`'s own comment has the arithmetic).
  The cost levers still only pay off together — publishing the current point instead of a trail
  keeps the *pointer's* own payload O(1) — but PR 2's traffic now rides alongside a materially
  larger `marks` array on every heartbeat and focus-change publish than when this note was first
  written. Re-check the combined presence size before assuming PR 2's plan still holds as written.
- **First component test trigger**: `docs/testing.md`'s bar is a bug of the focus/event-ordering
  shape, and none exists yet. If pointer capture over the textareas turns out to have one, that fix
  owes the first component test here — and note whether happy-dom needed a shim for
  `setPointerCapture`, since its `offsetTop`/`offsetHeight` are all 0 and geometry cannot be tested
  in it at all.
