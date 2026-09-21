# Takeover misses a device that connects its socket after revoke()

**Created**: 2026-09-17
**Issue**: #26
**Design**: no `docs/design/` doc — this is a small, self-contained fix to
`server/index.mts` / `server/ws-hub.mts`'s existing upgrade/revoke flow, not
a new mechanism. The flow itself is documented in `docs/design/chat.md` and
`docs/design/api.md` ("What the session registry decides").

## Milestones

### 1. Reject a stale session at upgrade time

- **What**: `WsHub.handleUpgrade` gains an optional `isSessionValid`
  predicate. If the workspace socket's session id doesn't pass it, the
  handshake still completes, but the socket is immediately told
  `session:revoked` and closed with the same `4001` code `revoke()` uses —
  it is never added to `connections`.
- **Files**: `server/ws-hub.mts` (new parameter + rejection branch, extract
  `REVOKED_CLOSE_REASON` / `REVOKED_FRAME` so `revoke()` and the new branch
  share them instead of duplicating the literal).
- **Reuse**: `REVOKED_CLOSE_CODE`, the `session:revoked` frame shape, and the
  "message before close" ordering all already exist in `revoke()` — this
  milestone only extracts them for a second caller, not add new ones.
- **Done**: a connection whose predicate returns `false` receives the frame
  and closes with `4001` without ever appearing in a `broadcast()`.

### 2. Wire the real predicate in the server entry point

- **What**: `server/index.mts`'s workspace-socket branch passes
  `(id) => sessionRegistry.resolve(id) !== null` as the predicate, so a
  session already invalidated by a takeover (`join()`'s eviction) is caught
  the moment the *new* connection tries to register — closing the exact
  race in #26, not just the already-registered case `revoke()` already
  covered.
- **Files**: `server/index.mts` (new `sessionRegistry` import, one extra
  argument on the existing `wsHub.handleUpgrade(...)` call for the
  workspace path only).
- **Reuse**: `sessionRegistry.resolve()` already exists and already returns
  `null` for a displaced session (`lib/auth/session-registry.ts:144-147`).
  `readSessionCookie` is already read at this exact call site. No new
  cookie-parsing or resolver code.
- **Done**: connecting with a cookie carrying an already-revoked session id
  gets closed with `4001` instead of registering.

## Acceptance

- [x] New test in `server/ws-hub.test.mts`: a connection whose injected
      predicate reports its session as invalid receives
      `{ event: "session:revoked", payload: null }` and closes with `4001`.
- [x] The file's existing 6 tests still pass unchanged (default predicate is
      a no-op, so today's behavior is untouched when no predicate is given).
- [x] `pnpm lint` / `pnpm test` / `pnpm build` pass.
- [x] `pnpm comments` / `pnpm verify:docs` pass.
- [x] `/code-review low` and `/simplify`, from a Sonnet session, run before
      the PR opens.
- [x] Manual container check (`pnpm docker:up`): reproduced the race with a
      scripted HTTP+WS client instead of two browser tabs — device A joins,
      device B force-joins the same nickname (evicting A before A ever opens
      a socket), then A connects its socket for the first time carrying the
      now-stale cookie. Confirmed it receives `{ event: "session:revoked",
      payload: null }` and closes with `4001` instead of registering.

## Cross-cutting

- Satisfies FR-020-08 (the takeover this issue's race undermines).
- No schema, migration, or config change. No docs go stale — the upgrade
  flow's own doc comments in `server/index.mts` / `server/ws-hub.mts` are
  updated in place as part of the fix, not left describing the old behavior.
- Related: #25 (where this race was first noticed and deliberately deferred).

## Review

Shipped exactly the two milestones as planned: `WsHub.handleUpgrade` gained
an `isSessionValid` predicate (default a no-op, so chat and existing tests
are untouched), and `server/index.mts` wires `sessionRegistry.resolve()` as
that predicate for workspace sockets. `/simplify` found one real
duplication (the send-then-close sequence repeated between `revoke()` and
the new rejection branch) and it was extracted into a shared private
`sendRevoked()` method. Nothing was cut; nothing moved to another task.
