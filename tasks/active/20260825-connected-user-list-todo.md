# Connected-user list

**Created**: 2026-08-25
**Issue**: —
**Design**: no new design doc. [`docs/design/api.md`](../../docs/design/api.md) §4.1 sketches a
server-held presence index over the workspace WebSocket, but that entry is scoped to FR-040 (user
tracking, Phase 3) and carries a `documentId` this task has no documents to put in. This builds the
FR-020-06/07 half only — who is here — and does it on Yorkie rather than the WS hub. See
**Why Yorkie, not the WS hub** below; `api.md` §4.1 should be revisited when FR-040 lands.

## Goal

The remaining half of `ROADMAP.md`'s Phase 0 exit criterion: two clients join the same workspace
and **see each other in a connected-user list**. Nickname and color tag, updating live as people
arrive and leave.

Out of scope: the document tree that FR-020-06 pairs with the list (no documents exist until
Phase 1), kicking a guest (UC-011, Phase 2), and per-document position (FR-040, Phase 3).

## Why Yorkie, not the WS hub

Presence is a solved problem inside Yorkie, and the parts that are easy to get wrong by hand are
the parts it already handles.

- **Disconnect detection is the hard half.** `server/rpc/yorkie_server.go:938` runs
  `defer unwatchDoc(...)` on the `WatchDocument` stream, so a browser that closes, drops off Wi-Fi,
  or is force-quit publishes `DocUnwatched` to the remaining peers immediately — not on the 30s
  housekeeping timer, which only cleans deactivated clients out of MongoDB. Rolling this by hand
  over the WS hub means re-implementing socket-lifetime bookkeeping that Yorkie already ships.
- **One fewer source of truth.** A server-held roster and Yorkie's own client list would be two
  answers to "who is online" that can disagree. Phase 1 attaches every client to Yorkie anyway.
- **`yorkie.Channel` was considered and rejected**: it reports a session *count*
  (`getSessionCount()`) and carries no per-client data, so it cannot satisfy FR-020-07's 유저네임 +
  색상 태그. Document presence carries arbitrary per-client state and can.

The WS hub keeps its existing job (FR-020-08 session revocation) and gains nothing here.

## Milestones

### 1. The presence contract

- **What**: the reserved workspace document key, the shape each client publishes about itself, and
  the rule that turns Yorkie's client list into a list of people.
- **Files**: `lib/presence/types.ts`, `lib/presence/roster.ts`, `lib/presence/roster.test.mts`.
- **Reuse**: `WorkspaceMember` from `lib/auth/types.ts` — presence republishes the identity the
  session registry already minted (id, nickname, color tag) rather than inventing a second one.
  The reserved-key idea is `docs/design/api.md`'s own (§2, the `chat` singleton document).
- **Done**: server and client agree on one type; nothing else in the repo names the key; the
  collapse rule is covered by tests that need neither a browser nor a running Yorkie.

### 2. Attach and render the roster

- **What**: one Yorkie client per browser, attached to the workspace document with this user's
  identity as `initialPresence`, listing everyone currently attached.
- **Files**: `app/workspace-presence.tsx` (replaces `app/yorkie-status.tsx`).
- **Reuse**: `lib/yorkie-address.ts` and the address-resolution comment block in
  `yorkie-status.tsx` — the loopback-vs-LAN bug it documents is still live and its fix is carried
  over verbatim. `yorkie-status.tsx` itself is a self-declared placeholder for the workspace
  screen, and this is that screen, so it is replaced rather than kept alongside — two components
  each opening their own `yorkie.Client` would mean two connections per browser.
- **Done**: a second browser joining appears in the first browser's list without a reload.

### 3. Wire it into the page

- **What**: the workspace page hands the component its identity and renders the list.
- **Files**: `app/page.tsx`.
- **Reuse**: the existing host/member resolution at the top of the page — the identity is already
  in hand, it just was not being passed anywhere.
- **Done**: see Acceptance.

## Acceptance

- [x] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [x] Two identities attached at once each show both, with their own color tags. Verified in a real
      browser against a real Yorkie: the host tab rendered `Host` (gray) and `bob` (blue).
- [x] A second identity appears without a reload (FR-020-07) — the open host tab went from
      `IN THIS WORKSPACE (1)` to `(2)` with no navigation.
- [x] Leaving removes that entry — the tab returned to `(1)` after the second client detached.
- [x] The same member joining from a second client shows once, not twice (FR-020-08). Measured: the
      raw roster reads `[alice, alice, bob]` and the dedupe by member id makes it `[alice, bob]`.
- [x] Two tabs on one device show one entry — both tabs displayed `(1)` — and closing one keeps the
      member listed.
- [x] The host appears in the list alongside guests.
- [x] A second *device* on the same Wi-Fi sees the same list. Verified on this branch from a second
      device over the LAN: it joined and appeared in the first device's roster.

## Cross-cutting

- **Requirements**: FR-020-06 (접속자 목록 half only), FR-020-07 (realtime reflection).
- **Roadmap**: closes the "see each other in a connected-user list" half of Phase 0's exit
  criterion. The other half — a Yorkie container restart preserving document content — is a
  verification task, not code, and is not covered here.
- **Docs that go stale**: `docs/design/api.md` §4.1 describes presence as server-held over the
  workspace socket. That is now true only for FR-040's document-position half, if at all. Not
  edited here — `api.md` is a team-agreed doc (AGENTS.md §5) and FR-040 is the task that should
  settle it.
- **Known gap, deliberately not addressed**: Yorkie is published on the LAN with no auth webhook
  (`docker-compose.yml` passes no `--auth-webhook-url`, and `POST /internal/yorkie/auth` from
  `api.md` §2 has no implementation). Anyone on the subnet can attach and publish presence under
  any nickname. Harmless while presence is all that rides on it; it becomes NFR-SEC-002/005's
  problem the moment Phase 1 puts document content in Yorkie.

## Review

**Status: working and verified.** The feature is finished and every acceptance box above is
ticked, the two-device LAN check included. What has *not* happened is the cleanup pass — see
"Open for whoever picks this up".

Shipped: `lib/presence/types.ts`, `lib/presence/roster.ts` (+ tests), `app/workspace-presence.tsx`,
and the three lines in `app/page.tsx` that hand it an identity. `app/yorkie-status.tsx` is deleted —
it was a self-declared placeholder for this screen, and keeping it would have meant two
`yorkie.Client`s per browser.

Cut before it was written: the WS-hub presence registry this task originally planned. Yorkie
answers the same question and handles the disconnect half that the hand-rolled version only
approximated. `server/ws-hub.mts` and `server/index.mts` are untouched — the hub keeps its existing
FR-020-08 revocation job and gained nothing here.

### How this was verified

Not from `pnpm dev` alone. Against a real `yorkieteam/yorkie:0.7.13` backed by `mongo:8`:

- A Node script attaching two and three clients, which is what proved the collapse in
  `rosterFrom()` is load-bearing — a member with two tabs really does appear twice in
  `getPresences()`.
- A real Chrome tab as the host, with a second identity attached from Node. The open tab went
  `(1)` → `(2)` → `(1)` with no reload as that client attached and detached, and rendered both
  color tags.

### Open for whoever picks this up

1. **The cleanup pass never ran.** `app/workspace-presence.tsx` still does two jobs — reporting
   whether Yorkie is reachable, and listing who is here. They share a connection, which is why
   they started as one component, but the render is now two unrelated things in one `return`.
   Splitting the status out is the obvious first move.
2. **Address resolution is split across two places.** `lib/yorkie-address.ts` deliberately refuses
   to resolve the host, and the component completes the address from `window.location`. The
   reasoning is sound and documented in both files, but the rule lives in halves.
3. **A late attach can outlive the component** — if cleanup runs while `client.activate()` is still
   pending, `deactivate()` returns immediately (the client is still `Deactivated`) and the chain
   then attaches anyway, leaving presence published with nothing pointing at it. `beforeunload`
   covers a closed tab; StrictMode's double-invoke and SPA navigation are not covered. Tracked as
   issue #32. `app/spike/prosemirror/page.tsx` already solves this by holding the setup promise and
   tearing down after it settles — that pattern is the fix.
4. **`(you)` is matched on `memberId`.** Fine today. Once the host can kick guests (UC-011) the
   component will need to know *what* you are, not just which entry is yours.
5. ~~**The two-device LAN check is still open**~~ — done. A second device on the LAN joined and
   showed up in the first device's roster. It needed two machines, not two tabs: one browser
   profile shares its cookies, so two tabs are always the same user. The identical box in
   `20260809-host-guest-entry-todo.md` was ticked from the same run, and that task is now archived.

### Two environment traps that cost time here

Both are written up in the lessons file with the exact errors:

- `pnpm docker:up` fails on Docker Compose older than 2.20 (`attach: false` in
  `docker-compose.yml`). The machine used here had 2.13.0.
- Running `pnpm build` before `pnpm dev` breaks the dev server with a `instrumentation.ts ... file
  not found` error for a file that exists. `rm -rf .next` fixes it.
