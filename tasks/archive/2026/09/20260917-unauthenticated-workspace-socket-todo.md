# Reject unauthenticated WebSocket upgrades

**Created**: 2026-09-17
**Issue**: #83
**Design**: no separate `docs/design/` doc — small, self-contained security fix; the design is
inline in the milestone below.

## Milestones

### 1. Gate both WS upgrade paths on session-or-host

- **What**: `/api/workspace/ws` and `/api/chat/ws` reject the upgrade with a 401 unless the
  request's cookies prove a live session or the host secret. Today only `/api/workspace/ws` read
  the session cookie, and neither path validated anything — `#82` put the document catalogue on
  the shared hub, so an unauthenticated LAN client could read document names off either path.
- **Files**: `lib/auth/session-cookie.ts` (generalize `readSessionCookie`'s parsing into
  `readCookie(header, name)`, add `isAuthenticatedSocket`), `server/index.mts` (gate in the
  `upgrade` handler, before either path reaches `wsHub.handleUpgrade`), `server/ws-hub.mts`
  (warning comment on `handleUpgrade` only — no behavior change), `docs/design/chat.md` (its
  anonymous-chat-socket paragraph is superseded by this change; updated in place, dated and
  issue-linked, per `/code-review`'s altitude finding — see lessons).
- **Reuse**: `sessionRegistry.resolve()` + `isHostSecret()` — the same two checks
  `currentMember()` already combines for every other route. `wsHub`/`ws-hub.mts`'s behavior is
  untouched (one warning comment only); the gate lives entirely in `server/index.mts`, which is
  where the raw request/cookie header exists.
- **Done**: a `ws` client with no cookies gets the upgrade rejected (socket destroyed, no entry
  ever added to `wsHub`) on both paths; a real guest session and the host's `role` cookie still
  connect exactly as before.

## Acceptance

- [x] `pnpm test` — new `isAuthenticatedSocket`/`readCookie` tests pass, no regressions
      (564 passed after removing one redundant case `/code-review` flagged).
- [x] `pnpm build` — typechecks clean.
- [x] `pnpm lint` — clean.
- [x] Manual container check (`AGENTS.md` §2 — networking changes verified against the container,
      not `pnpm dev`): via `pnpm docker:up` —
      - anonymous `ws` client → `401` on both `/api/workspace/ws` and `/api/chat/ws`.
      - a `role` cookie with the wrong value → `401`.
      - the real host `role` cookie (from the printed boot line) → opens on both paths.
      - a real guest session (`POST /api/workspace/join`) → opens `/api/workspace/ws`, and a
        `POST /api/documents` made afterward delivers `document:created` to it over that same
        socket, unchanged from before this fix.

## Cross-cutting

- Closes #83. NFR-SEC-002/005 — the same "no unauthenticated LAN access" line
  `docs/design/api.md` §2 already draws for Yorkie's own auth webhook, now applied to this
  project's own WS hub too.
- `server/index.mts`'s comment claiming chat's upgrade path is "byte-for-byte what it was" is now
  out of date and corrected in the same change.
- `docs/design/chat.md`'s "Agreed" anonymous-chat-socket paragraph is superseded in place (dated,
  issue-linked) rather than left silently wrong — `/code-review`'s altitude pass caught that this
  fix reverses a documented decision, not just a bug.

## Review

Ran `/simplify` (4 parallel angle reviews) before opening the PR, per `AGENTS.md` §6. Findings
applied: removed a redundant test case, stopped double-parsing the session cookie per upgrade,
added a warning comment on `WsHub.handleUpgrade` about the gate living in its one caller. Two
findings deliberately not applied this task — the five-call-site duplication of the
session-or-host predicate, and wiring the check into `ws`'s own `verifyClient` instead of a manual
`socket.write` — both recorded in lessons as follow-ups, not done here because both are larger
than this fix needs. The chat.md doc-supersession finding was applied in full.

Nothing cut from the original milestone; scope grew by exactly the two files (`ws-hub.mts` comment,
`chat.md` supersession) the review surfaced as necessary, not by anything else.
