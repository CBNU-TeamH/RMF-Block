# Takeover misses a device that connects its socket after revoke() — lessons

**Created**: 2026-09-17

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The container-check step in `AGENTS.md` implies opening two browser tabs,
  but the whole race is HTTP + WebSocket with no rendering involved — a
  small scripted client (`fetch` for `/api/workspace/join`, `ws` for
  `/api/workspace/ws`, reading the `Set-Cookie` header by hand) reproduced
  the exact race against `pnpm docker:up` faster and more reliably than a
  manual two-tab click-through would have.
- A `test("message", ...)` listener attached only after `await`-ing a
  WebSocket's `open` promise can miss frames the server sends immediately
  on connect, if server- and client-side event emission happen to land in
  the same synchronous flush. `server/ws-hub.test.mts`'s new regression test
  had to attach `message`/`close` listeners right after `new WebSocket(...)`,
  before `open` fires, instead of using the file's existing `connect()`
  helper (which awaits `open` first) — safe for `revoke()`'s tests only
  because those trigger the send from a separate, later action.

## What we would do differently

- Nothing — the predicate-injection design (`isSessionValid`) held up
  through all four `/simplify` review angles unchanged; only the send+close
  duplication needed a fix.

## Worth extracting

- The one-off HTTP+WS reproduction script written for this task's manual
  check is a candidate for a small reusable helper if a future auth/session
  bug needs the same kind of container-level reproduction — not extracted
  now since this is the first time it's come up.
