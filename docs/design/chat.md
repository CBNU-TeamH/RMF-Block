# Chat — Module Design (Version A: text and file attachments)

- **Status**: Agreed. Built through file attachments; link attachments and the file panel
  are still out of scope — see below.
- **Owns**: `lib/chat/`, `lib/files/` (the upload/serving mechanism — see "Module structure"
  below; reused by the PDF block in `docs/design/document-editing.md`, not re-explained there),
  `app/(workspace)/chat-message.tsx`, `app/(workspace)/chat-panel.tsx`,
  `app/(workspace)/chat-window.tsx`, `app/api/chat/`, `app/api/files/`.
- **Related**: [`docs/design/architecture.md`](architecture.md) §3(b) (Chat API group); [`docs/design/api.md`](api.md) §5 (Version A vs Version B); [`docs/SRS-ko.md`](../SRS-ko.md) FR-060, SIR006

## Scope

`api.md` §5 already settled the two-version split (Version A: server REST+WebSocket; Version B:
Yorkie-native document). This doc covers **Version A**: FR-060-01 (text), FR-060-02 (file
attachments), FR-060-04 (realtime delivery), FR-060-05 (history and attachment info persisted),
FR-060-07 (failure surfaced to sender).

Still out, and each for its own reason: **URL and block/document-link attachments**
(FR-060-03/06) are a second attachment kind carrying no bytes, and the `attachment` field below
is shaped so they join as a sibling rather than a special case; **UC-061's file-management
panel** is a screen over the same store, on its own branch.

The UI is a **prototype**. There is no chat artboard in [`docs/ui/`](../ui/), so the panel and
its floating window borrow the shell's own tokens and are meant to be replaced once a design
exists. The window's geometry is the one part with rules worth keeping — see below.

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
  types.ts             — ChatMessage, ChatAttachment, ChatRepository/ChatBroadcaster, ChatValidationError
  chat-repository.ts   — JSON-file-backed ChatRepository
  chat-service.ts       — ChatService(repository, broadcaster): send()/list()
  window-frame.ts      — the floating window's geometry, as pure functions
lib/files/
  types.ts             — StoredFile metadata
  file-repository.ts   — bytes on disk, metadata in JSON
  serving.ts           — the preview/download response rule (see api.md §1)
server/
  ws-hub.mts             — generic WS connection registry + broadcast; not chat-specific
  index.mts               — custom server entry point (HTTP + Next handler + WS upgrade routing)
app/api/chat/
  route.ts                — GET (history) / POST (send)
  files/route.ts          — POST (upload)
app/api/files/[id]/
  preview/route.ts        — inline, images only
  download/route.ts       — attachment, always opaque
app/(workspace)/
  chat-window.tsx         — the floating window and the bar that opens it
  chat-panel.tsx          — history, live feed, composer
  chat-message.tsx        — one message row
.data/chat/messages.json — persisted history (gitignored; `.data/` is the app's own state directory, per ADR-002)
.data/files/             — uploaded bytes, named by id; `index.json` alongside them
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

**Message shape.** `sender` is the session's nickname, resolved by the route from the session
cookie. A `sender` in the request body is ignored, and a request with no session is refused
before anything is stored:

```ts
type ChatAttachment = { fileId: string; fileName: string; fileType: string; size: number };
type ChatMessage = {
  id: string;
  sender: string;
  text: string;
  sentAt: string;
  attachment?: ChatAttachment;
};
```

This was a real hole rather than a tidy-up. `sender` came off the request body and the route
checked no session at all, so anything on the LAN could post as any name without joining the
workspace. The prediction this doc made — *"a `ChatService` caller-side change, not a schema
change"* — held: `ChatService` and `ChatRepository` were untouched.

`attachment` is optional rather than a second message type, because FR-060-04 has the message
and its attachment info travelling together and UC-060 step 1 has the user typing text *or*
attaching a file. Its four fields are **deliberately the same four as `FileBlock`** in
`lib/blocks/types.ts`: a file attached to a message and a file embedded in a document are one
thing seen from two places.

The client sends only a `fileId`; the server looks the file up and builds the attachment from
stored metadata. A client that could name its own `fileName` or `size` could describe someone
else's upload however it liked.

**`ws-hub.mts` caches its singleton on `globalThis`**, mirroring `lib/host-secret.ts`'s existing
pattern, so `next dev`'s module-reload (HMR) can't split connection state into two registries.

## The floating window

Chat is a window over the workspace, opened from a bar in the bottom-right corner, not a rail
down the side of the shell — a rail takes a column from the documents and cannot be put away.
It opens at a ninth of the viewport (a third of each side) against the bottom right, moves by
its title bar, and resizes by its left, right and bottom borders. There is no top border to
pull: that edge is the title bar.

Closing and reopening restores the size and position it was left at rather than resetting to
that default. The placement is a decision someone made about their own screen, and asking for
it again every time is the annoyance this removes. It lives in `localStorage` because that is
exactly what it is — one viewer's convenience, on one device, worth nothing to anyone else and
never sent anywhere.

**All of it is arithmetic in `lib/chat/window-frame.ts`, with the viewport passed in as an
argument**, so every rule can be checked without a browser. That matters more here than the
size of the feature suggests, because the failure mode is unrecoverable: a window dragged off
the top cannot be grabbed again, and it is a bug you only meet at a viewport size nobody
happened to try.

Two rules are worth stating because the obvious implementation gets them wrong:

- **The window reaches the left, right and top edges, but never the bar that opens it.** That
  floor applies wherever the window is horizontally, not only where it would actually overlap
  the button — a limit that changed with the window's x would feel like snagging on something
  invisible. `BAR_HEIGHT` is the single source for both the limit and the bar's rendered
  height; two copies drifting apart is precisely how the window ends up covering its own
  launcher.
- **A border drag moves one edge and leaves the other three still.** So the moving edge is
  clamped as a *position* and the size derived from where it landed, not the other way around.
  Clamping the width instead makes the window slide sideways once it can get no narrower, and
  the border runs away from the pointer.

## Isolation

Existing files keep their current logic untouched. The only touch-points are mechanical
boot/build config, not business logic: `next.config.ts` (drop `output: "standalone"`),
`package.json` (`ws`/`@types/ws` deps, `dev`/`start` scripts point at `server/index.mts`),
`Dockerfile` (runtime stage installs full prod `node_modules`, `CMD` runs `server/index.mts`).

## Open questions

- Whether Version A and Version B can share a client-facing interface — `api.md`'s existing open
  question; `ChatRepository`/`ChatBroadcaster` are written so `ChatService` itself wouldn't need to
  change if that gets resolved, but the resolution isn't attempted here.
- **URL and block/document-link attachments** (FR-060-03/06). The `attachment` field is shaped
  to take a sibling kind, but what a link attachment stores — and what happens to it when the
  block it points at is deleted — is that task's question.
- **Deleting an attachment.** No FR covers it, and it raises one this module should not answer
  alone: whether removing a file removes the message that carried it.
- **A real design for the UI.** What ships is a prototype built from the shell's tokens.

Settled since this doc was first written:

- ~~`sender` becomes session-derived once UC-020 guest login exists~~ — done, and it was a
  live authentication hole rather than a loose end. See the message shape above.
- ~~File attachments as additive fields on `ChatMessage`~~ — done, as `attachment?`. The
  reasoning `document-editing.md` used for block `content` held: no rewrite was needed.
