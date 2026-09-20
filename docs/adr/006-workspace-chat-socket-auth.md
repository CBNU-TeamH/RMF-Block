# ADR-006: Both WebSocket upgrade paths require a live session or the host secret

- **Status**: Accepted — decided by the team (issue #83), landed on `main` via PR #107
  (2026-09-20).
- **Date**: 2026-09-17
- **Related**: [ADR-005](005-custom-server-rest-ws.md) (the server and hub this gates), issue #83,
  PR #82, PR #107, [`docs/design/chat.md`](../design/chat.md)

## Context

`/api/workspace/ws` read the session cookie on upgrade but never validated it. `/api/chat/ws`
validated nothing at all — by original design: `docs/design/chat.md` recorded "chat never
required authentication and still does not," reasoning that an anonymous connection could still
only *receive* broadcasts, since posting a message required a valid session on the REST side.

That reasoning held only as long as the shared `wsHub` ([ADR-005](005-custom-server-rest-ws.md))
carried nothing more sensitive than chat messages a guest could already see in the room. PR #82
put the document catalogue onto the same hub — `document:created/changed/deleted` events naming
every document as it is created, renamed, moved, or deleted. Because `wsHub` broadcasts to every
attached connection regardless of upgrade path, any unauthenticated client on the LAN could open
either socket and receive chat messages, session-revoked notices, and the full document
catalogue, without ever holding a session.

Issue #83 filed this as a decision the team needed to make, not a bug to quietly patch: "does
chat's socket authenticate now?" is a real question with a real cost either way, not a one-line
fix to fold into another PR.

## Decision

1. **Both upgrade paths call a shared `isAuthenticatedSocket(sessionId, cookieHeader)` predicate
   before the socket is ever registered with `wsHub`.** `lib/auth/session-cookie.ts`'s
   session-only `readSessionCookie()` was generalized into `readCookie(header, name)` to read the
   `role` cookie during a raw WS upgrade (no Next `cookies()` jar is available there), and
   `isAuthenticatedSocket` mirrors the existing `currentMember()` two-branch check: a live session
   via `sessionRegistry.resolve(...)`, or the host secret via `isHostSecret(...)`.
2. **Failure ends the raw socket with a 401 before the handshake completes**, and before
   `wsHub.handleUpgrade()` is ever called — the connection never reaches the shared broadcast bus.
3. **Chat connections remain otherwise anonymous.** Only entry is gated; a chat socket's
   `sessionId` is still not filed for `revoke()` bookkeeping the way a workspace socket's is. This
   ADR closes the *unauthenticated entry* leak, not the separate question of per-connection
   attribution on the chat path.

## Alternatives considered

- **Filter broadcasts per upgrade path instead of gating entry** — rejected. `wsHub` has no
  per-path filtering today; retrofitting it is a larger change than gating entry, and it would
  still leave an unauthenticated socket open to whatever else might later be broadcast on it.
- **Wire the check into `ws`'s own `verifyClient`/`abortHandshake` instead of a manual
  `socket.end(...)`** — deferred, not rejected. It would need restructuring how `WsHub` is
  constructed, and is left as noted future work for whenever a third upgrade path is added.
- **Fix only `/api/workspace/ws` and leave chat as originally designed** — rejected. Chat already
  carries the document catalogue via the same shared hub, so a workspace-only fix would not close
  the leak PR #82 introduced.

## Consequences

- `docs/design/chat.md`'s "chat never required authentication" paragraph is superseded in place —
  dated and issue-linked, per `AGENTS.md` §5's convention for changing an already-agreed
  design-doc decision, not silently rewritten.
- `sessionRegistry.resolve(...) || isHostSecret(...)` is now duplicated across five call sites.
  Accepted here, not addressed — a shared helper is a smaller follow-up than anything this ADR
  needs to decide.
- Enforcement lives in the **caller** (`server/index.mts`), not in `WsHub` itself. `ws-hub.mts`
  carries a doc comment warning of this, so a future third upgrade path wired directly into the
  hub does not silently bypass the gate the way the two existing paths would have without this
  ADR.
