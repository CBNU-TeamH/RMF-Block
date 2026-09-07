# The document tree — lessons

**Created**: 2026-09-08

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **The hub's "not chat-specific" claim was true, and this is the first time anything tested it.**
  `ws-hub.mts` says it imports nothing chat-related so a future feature can reuse it through
  `ChatBroadcaster` (NFR-MAI-001). Three catalogue broadcasts went in without touching the hub at
  all. A comment that predicted its own second caller, and was right.

- **The type checker caught a bug that would have shipped silently.** `onClick={openDialog}` passes
  the `MouseEvent` as the function's first argument — which had just become `parentId`. Every "+ 새
  문서" click would have tried to create a document under a parent whose id was `[object Object]`,
  and the route's own "상위 문서를 찾을 수 없습니다" would have been the only symptom.

## What we would do differently

- **Check the socket path against the server, not against memory.** The first version connected to
  `/ws`; `server/index.mts` upgrades `/api/chat/ws` and `/api/workspace/ws` and nothing else. It
  cost a browser round-trip to notice something `grep 'new WebSocket'` would have answered in one.

- **A `useEffect` that mirrors a prop into state is a lint error here, and rightly.** The list
  seeds from a server component and then takes socket deltas, which reads like "copy props to state
  on change" — but React's own pattern is to adjust during render, and the effect version renders
  twice for every `router.refresh()`. eslint named it before it was measured.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **A rule the SRS does not state can still be the one most worth testing.** Nothing forbids a
  document being its own grandparent, because nobody writes that down — and a tree UI with
  drag-to-move produces it on the first careless drop, after which the loop is unreachable from the
  root and invisible in every view. `wouldCycle` exists for a requirement that is not in the
  document. Proposal: `conventions.md` already lists what may stay as a comment; a sibling note
  that an invariant the SRS omits belongs in a *test*, since there is no requirement id to cite.

- **This browser cannot verify WebSockets at all** — every socket hangs at `readyState=0`, chat's
  included. Worth recording next to `AGENTS.md` §2's "Run and verify": realtime behaviour is
  checked with a Node client (`ws`) against the running server, and the browser only shows what
  arrives once it is connected.
