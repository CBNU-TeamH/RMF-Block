# Reject unauthenticated WebSocket upgrades — lessons

**Created**: 2026-09-17

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **The issue's own title undersold its scope.** #83 is titled around "the workspace WebSocket,"
  but `server/ws-hub.mts`'s `broadcast()` sends to every connection in its one shared `Map`
  regardless of which of the two upgrade paths (`/api/chat/ws` vs `/api/workspace/ws`) registered
  it — there is no per-path or per-channel filtering anywhere in the hub. Gating only
  `/api/workspace/ws` would have left `/api/chat/ws` as an equally valid way to receive the exact
  same `document:created` broadcast the issue reported. The fix had to cover both paths for the
  reported leak to actually close, not because of a policy preference about chat's auth model.
- **`sessionRegistry.resolve()` wants `string | undefined`, `readSessionCookie()` returns
  `string | null`.** `pnpm test` didn't catch the mismatch at all — the mocked `sessionRegistry`
  in the unit test accepts anything. Only `pnpm build`'s `tsc` pass caught it. Worth remembering:
  a mocked dependency's type is whatever the mock declares, not the real module's — a test suite
  that only mocks can go green on a type error a build catches immediately.
- **The host also opens `/api/workspace/ws`, not just guests.** Confirmed by reading
  `app/(workspace)/layout.tsx`'s own gate (`isHost || member`) before assuming the fix only needed
  to check `sessionRegistry` — `document-list.tsx`, which opens this socket, renders under that
  same layout for the host too. A fix that only accepted a resolved session would have locked the
  host out of their own document list.

## What we would do differently

- Nothing to add — the issue's own "Suggested fix" and "Reproduced" sections already did most of
  the investigation; confirming the shared-broadcast scope gap was the only extra step needed
  before writing the fix.

## Worth extracting

- **A shared broadcaster reached by more than one entry point needs its auth check applied at
  every entry point, not the one the bug report named.** `wsHub.broadcast()` has no concept of
  which upgrade path a connection came from, so "the workspace socket leaks data" and "the chat
  socket leaks data" were never two separate bugs — checking only the named path would have left
  the fix incomplete without any test or manual check catching it, since both paths produce the
  same symptom. Worth a line near `docs/conventions.md`'s S-5 (ignore an existing precedent) or as
  its own note: before gating one entry point into shared infrastructure, grep for every other
  entry point into the same instance.
- **Fixing a shared-infrastructure leak by authenticating every caller silently reversed a
  different, already-"Agreed" design doc** (`docs/design/chat.md`'s anonymous-chat-socket
  paragraph) — caught by a `/code-review`-style altitude pass, not by writing the fix. The doc got
  updated in the same change (superseded-in-place, dated, issue-linked — the pattern this repo's
  own ADRs already use), but the near-miss is the lesson: a fix framed as "close the leak" can
  quietly also be "reverse an agreed decision," and the second thing needs saying out loud
  (`AGENTS.md` §5) even when it falls out of the first as a side effect rather than being the
  point of the change.
- **Not done here, flagged for later**: `sessionRegistry.resolve(...) || isHostSecret(...)` is now
  written in five places (`current-member.ts`, twice in `app/api/documents/route.ts`,
  `app/api/documents/[id]/route.ts`, and this task's `isAuthenticatedSocket`) — two genuinely
  different cookie sources (Next's `cookies()` jar vs. a raw header) but the same two-branch
  boolean each time. Worth factoring the predicate itself out once a third call site needs
  touching, not as part of this fix.
- **Not done here, considered**: wiring the auth check into `ws`'s own `verifyClient` /
  `abortHandshake` (already a capability of the installed `ws` dependency, see
  `websocket-server.js`) would make the 401 response spec-conforming for free and would make a
  future third upgrade path on this hub harder to add without the gate. Left as a manual
  `socket.write(...)` + a warning comment on `WsHub.handleUpgrade` instead, because restructuring
  `WsHub`'s construction to accept a verifier is a bigger change than this issue needs — worth
  revisiting if a third path is ever added to this hub.
