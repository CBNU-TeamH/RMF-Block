# ADR-005: A custom Node server owns REST and WebSocket upgrades in one process

- **Status**: Accepted
- **Date**: 2026-09-17
- **Related**: [ADR-003](003-stack-choices.md) (Decision 2 — Next.js App Router), [ADR-006](006-workspace-chat-socket-auth.md) (the auth gate this server's upgrade paths need), [`docs/design/chat.md`](../design/chat.md) "Why a custom server is unavoidable here"

## Context

FR-060-04 requires realtime chat delivery, and the workspace needs server push for presence,
document-catalogue, and session-revocation events that don't fit Yorkie's own sync channel
(ADR-001, ADR-003 Decision 1). The pinned Next.js version (16.2.12) has no WebSocket support in
Route Handlers — verified by grepping the installed package's `dist` for the feature, which
exists only as an upstream RFC, absent from this version. Next's `output: "standalone"` build
mode and a hand-written server entry point are also mutually exclusive: standalone always ships
its own generated `server.js` and does not trace a custom one.

So realtime delivery forces two structural, non-negotiable changes, not a preference: a custom
server entry point, and dropping `output: "standalone"` from `next.config.ts`.

## Decision

1. **`server/index.mts` is a hand-written custom server.** It wraps Next's own request handler
   with a raw Node `http` server and adds an `upgrade` listener, so one process serves both
   Next's pages/API routes and WebSocket upgrades. No route/page logic changes — this is a
   boot-mechanism swap, not a rewrite of anything under `app/`.
2. **`server/ws-hub.mts` is a generic connection registry and broadcast primitive, not
   chat-specific.** It is written once and reused by chat, the document-catalogue events
   (`document:created/changed/deleted`), and session-revoked notices, rather than being built
   for chat and extracted later. Its singleton is cached on `globalThis`, mirroring
   `lib/host-secret.ts`'s existing pattern, so `next dev`'s module-reload (HMR) cannot split
   connection state into two registries.

```
Client(s) ──HTTP──▶ server/index.mts ──▶ Next's request handler (pages, API routes)
Client(s) ──WS upgrade──▶ server/index.mts ──▶ server/ws-hub.mts (registry + broadcast)
```

## Alternatives considered

- **A separate WebSocket microservice or process** — rejected. It doubles the deployment surface
  (two processes to start, monitor, and reach on the LAN) for state that fits comfortably in one
  process at this scale, and cuts against ADR-003 Decision 2's reasoning that the server has too
  little to do to justify structure beyond what the problem needs.
- **Polling instead of a WebSocket** — rejected. FR-060-04 requires realtime delivery; polling
  trades that away for no structural benefit, since the custom-server cost (below) is paid either
  way once any server push is needed.
- **A managed realtime provider (Pusher, Ably, or similar)** — rejected outright. The deployment
  is LAN-only with no internet dependency assumed (SRS scope); a cloud relay is not reachable in
  that environment even if it were otherwise attractive.

## Consequences

- Same `node_modules` cost [ADR-003](003-stack-choices.md) Decision 2 already noted, recorded
  here too since it follows from this ADR's decision, not Next's.
- `wsHub` is **one shared broadcast bus with no per-path filtering**. Every connection that
  attaches to it — chat, workspace — receives everything broadcast to it, regardless of which
  upgrade path it came in on. This was a deliberate simplicity choice at the time (one registry,
  not one per feature), and it is exactly the condition [ADR-006](006-workspace-chat-socket-auth.md)
  later has to gate: once the document catalogue started broadcasting over this same hub, an
  unauthenticated connection to either path could read it.
- `lib/` stays framework-free per ADR-003's reversibility argument: `server/index.mts` is the one
  place that knows both Next and the raw Node `http`/`ws` APIs.
