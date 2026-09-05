# Presence and Focus Following

- **Status**: Built. UC-030's thin slice (share → follow → end) is live; the rest of `lib/focus`
  and `lib/presence` supports it and the connected-user list.
- **Owns**: `lib/presence/`, `lib/focus/`, `app/(workspace)/presence-provider.tsx`,
  `app/(workspace)/presence-stack.tsx`, `app/(workspace)/focus-follow-provider.tsx`,
  `app/(workspace)/focus-share.tsx`, `app/(workspace)/documents/[id]/use-focus-presence.ts`.
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

## `FocusShare`'s four states

One control, four mutually exclusive states, checked in an order that assumes a member is never
simultaneously presenting and following: presenting → 종료 my own share; following someone →
end that follow; someone else presenting and I am not → 참여하기; otherwise → 공유하기.

The button stays visible (disabled, not hidden) outside a document, because `FR-030-01`'s context
— "발표자가 바라보고 있는 문서로 시점을 고정시킨다" — has no view to anchor a share to on the
document list or anywhere else in the shell. Hiding it would make the control pop in and out of
the header on every navigation instead.

Starting a share reads the current anchor straight off the live DOM at the moment of the click,
rather than threading it down through context continuously — the anchor is only needed once, at
that moment, and a `null` read (the editor for this route hasn't finished mounting) is rare and
self-resolves: nothing happens, and pressing the button again a moment later works. Marked
`simple:` in the source for exactly this tradeoff.
