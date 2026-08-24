# Chat — Module Design (Version A, text slice)

- **Status**: Agreed for this slice only. Scope is deliberately narrow — see below.
- **Related**: [`docs/design/architecture.md`](architecture.md) §3(b) (Chat API group); [`docs/design/api.md`](api.md) §5 (Version A vs Version B); [`docs/SRS-ko.md`](../SRS-ko.md) FR-060, SIR006

## Scope

`api.md` §5 already settled the two-version split (Version A: server REST+WebSocket; Version B:
Yorkie-native document). This doc covers **Version A's first slice only**: FR-060-01 (text),
FR-060-04 (realtime delivery), FR-060-05 (history persisted), FR-060-07 (failure surfaced to
sender). File/URL attachments (FR-060-02/03), block/document-link jump (FR-060-06), and UC-061's
file-management panel are explicitly out — the module structure below leaves room for them without
requiring a rewrite (see Open questions).

No chat UI is designed here — this is the server module (REST + WebSocket + persistence) only.

## Why a custom server is unavoidable here

The pinned Next.js version (16.2.12) has no WebSocket support in Route Handlers — verified by
grepping the installed package's `dist` for the feature (it exists only as an upstream RFC,
absent from this version). Next's `output: "standalone"` build mode and a custom server are also
mutually exclusive (standalone always ships its own generated `server.js`; it does not trace a
hand-written one). So realtime delivery (FR-060-04) forces two structural, non-negotiable changes:
a custom server entry point, and dropping `output: "standalone"` from `next.config.ts` (Dockerfile
moves from copying the standalone trace to installing full production `node_modules`). Neither
touches existing route/page logic — both are boot-mechanism swaps.

## Module structure

```
lib/chat/
  types.ts             — ChatMessage, ChatRepository/ChatBroadcaster interfaces, ChatValidationError
  chat-repository.ts   — JSON-file-backed ChatRepository
  chat-service.ts       — ChatService(repository, broadcaster): send()/list()
server/
  ws-hub.mts             — generic WS connection registry + broadcast; not chat-specific
  index.mts               — custom server entry point (HTTP + Next handler + WS upgrade routing)
app/api/chat/
  route.ts                — GET (history) / POST (send)
.data/chat/messages.json — persisted history (gitignored; `.data/` is the app's own state directory, per ADR-002)
```

**`ChatService` depends on two small interfaces, not concrete classes**:

```ts
interface ChatRepository { append(message: ChatMessage): Promise<void>; list(): Promise<ChatMessage[]>; }
interface ChatBroadcaster { broadcast(event: string, payload: unknown): void; }
```

This is the one deliberate abstraction in the module, and it is justified by two concrete,
already-foreseeable needs rather than speculative future-proofing: (1) `docs/design/api.md`'s open
question — whether Version A and Version B end up sharing a client-facing interface — needs
`ChatService`'s persistence and fan-out to be swappable without becoming entangled with HTTP or
WebSocket specifics; (2) `ChatBroadcaster` is implemented by `ws-hub.mts`, which is written as a
**generic** connection registry, not chat's own — `architecture.md`'s Presence/Follow API group
will need the same "broadcast to connected clients" primitive later (NFR-MAI-001: independent
module structure), and this way it doesn't have to be extracted out of chat code after the fact.

**Storage — JSON file, not in-memory or a database**: chosen so history survives a server restart
(closer to FR-060-05's intent than in-memory). A database does exist in the deployment — MongoDB —
but it is Yorkie's internal store, and ADR-002 fixes the boundary that the app never connects to it.
So app-owned state stays as JSON files under `.data/`, and this module is the reference
implementation of that pattern.

**Message shape** (no real user-identity system exists yet — that's UC-020's guest login,
FR-020-01~05, not built):

```ts
type ChatMessage = { id: string; sender: string; text: string; sentAt: string };
```

`sender` is client-supplied for this slice. It becomes server-derived (from session) once login
lands — a `ChatService` caller-side change, not a schema change.

**`ws-hub.mts` caches its singleton on `globalThis`**, mirroring `lib/host-secret.ts`'s existing
pattern, so `next dev`'s module-reload (HMR) can't split connection state into two registries.

## Isolation

Existing files keep their current logic untouched. The only touch-points are mechanical
boot/build config, not business logic: `next.config.ts` (drop `output: "standalone"`),
`package.json` (`ws`/`@types/ws` deps, `dev`/`start` scripts point at `server/index.mts`),
`Dockerfile` (runtime stage installs full prod `node_modules`, `CMD` runs `server/index.mts`).

## Open questions

- Whether Version A and Version B can share a client-facing interface — `api.md`'s existing open
  question; `ChatRepository`/`ChatBroadcaster` are written so `ChatService` itself wouldn't need to
  change if that gets resolved, but the resolution isn't attempted here.
- `sender` becomes session-derived once UC-020 guest login exists — tracked above, not a blocker.
- File/link attachments and UC-061 file-management panel: additive `content`-style fields on
  `ChatMessage` when that task starts, following the same reasoning `document-editing.md` used for
  block `content` — not designed here to avoid speculating ahead of that task's actual requirements.
