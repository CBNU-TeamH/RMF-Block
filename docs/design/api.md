# API Design — Endpoint Catalog

- **Status**: Draft. Endpoints only — no request/response schemas yet. Shipped so far: `/api/auth/host` (as a simplified interim `GET` + query param, not the `POST` below — see `app/api/auth/host/route.ts`), `/api/workspace/join`, `/api/chat`, `/api/chat/files`, `/api/files/:id/preview`, `/api/files/:id/download`, plus two endpoints this catalogue does not list because they are not client-facing: `/api/auth/yorkie-token` (issues a per-session token) and `/api/internal/yorkie/auth` (the webhook Yorkie itself calls). Every other row below is target design, not yet built.
- **Related**: [`docs/design/architecture.md`](architecture.md) §3(b); [`docs/adr/002-persistence-on-yorkie-mongo.md`](../adr/002-persistence-on-yorkie-mongo.md); [`docs/SRS-ko.md`](../SRS-ko.md) §3.2, §3.3

## Scope

`architecture.md` §3(b) fixes the API **groups** and defers endpoint-level detail to a separate API design doc (SRS §1.2 schedules it for "개발 중"). This is that doc.

It lists **which endpoints exist, on which transport, and which requirement each one serves**. Request/response bodies, status codes, and error shapes are deliberately out of scope — they are settled per module, alongside that module's design doc. The point of writing the catalog first is that the client, server, and Yorkie integration can be built in parallel against an agreed surface.

## Deployment assumptions

These shape every path below:

- **One workspace per server instance.** The host runs one container for one collaboration session (SRS UC-010; restore in E1-1 reopens *the* workspace, not one of many). Paths are therefore singular — `/api/workspace`, not `/api/workspaces/:id`.
- **Two roles**: host and guest (SRS §3.1.1). A guest authenticates with a nickname plus the workspace password. Host identity derives from container access — see below.

## Authentication model

| Actor | How identity is established |
| --- | --- |
| Host | The server generates a bootstrap secret at startup and prints it to container stdout alongside the join URL (FR-010-03 already puts the join address on the host's screen). Only whoever ran the container can read stdout, so possession of that secret proves host identity. It is exchanged once for a host session token. |
| Guest | Nickname + workspace password (FR-020-02/03). A known nickname re-attaches to the existing user rather than creating a new one (FR-020-08). |

**Shipped today is none of the below.** A join issues one opaque `randomUUID()` session id held
in an in-memory `Map` (`lib/auth/session-registry.ts`) and set as a cookie with no `maxAge` — no
expiry, no rotation, no refresh endpoint, no reuse detection. The model in this section is target
design; the header note above covers the REST rows, not this prose.

Access tokens live 30 minutes; refresh tokens live 7 days. Refresh-token reuse is treated as a theft signal: it invalidates the token family and forces the host to re-read the bootstrap secret from stdout.

Rotation bounds how long a leaked token stays replayable. It does **not** protect against a token leaking live — most plausibly by appearing in the address bar during screen sharing (UC-030) — so the client strips the token from the URL immediately after handoff and keeps it out of persistent storage. LAN traffic is unencrypted, so rotation narrows the replay window rather than preventing interception.

There is no separate "revoke all sessions" endpoint. The host runs the container directly, so restarting it is the revoke path: a fresh bootstrap secret is printed to stdout and every existing session token is invalidated. Adding a dedicated revoke action would duplicate that and overlap with the per-guest kick (`DELETE /api/workspace/members/:userId`, not yet built).

## 1. REST — client ↔ rmf-block-server

`host` in the Auth column means host-only; FR-011-07 requires the server to reject these from anyone else.

### Health

| Method | Path | Purpose | Auth | Traceability |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | Liveness of this server and its Yorkie dependency | — | HIR001, SOIR002 |

### Auth

| Method | Path | Purpose | Auth | Traceability |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/host` | Exchange the stdout bootstrap secret for a host session token | — | FR-011-07 |
| `POST` | `/api/auth/refresh` | Rotate an expiring session token (host and guest) | refresh token | NFR-SEC-002 |

### Workspace

| Method | Path | Purpose | Auth | Traceability |
| --- | --- | --- | --- | --- |
| `POST` | `/api/workspace` | Create the workspace — name + access password | host | FR-010-01~04 |
| `GET` | `/api/workspace` | Initial snapshot: document tree + the workspace's known members; reports whether preserved data exists to restore — both come from `.data/`, while document content is already live in Yorkie/MongoDB | guest | FR-010-05, FR-020-06 (tree half) |
| `POST` | `/api/workspace/join` | Guest join — nickname + workspace password; issues a session token | — | FR-020-01~05, FR-020-08 |
| `PATCH` | `/api/workspace/password` | Change the access password; existing sessions stay valid | host | FR-011-04~07 |
| `DELETE` | `/api/workspace/members/:userId` | Kick a guest and close their connection | host | FR-011-01~03, FR-011-07 |

`GET /api/workspace`'s members are **who belongs to this workspace**, not who is online — the
persistent record `.data/` keeps so a kick (`DELETE …/members/:userId`) and a restore have something
to act on. The live 접속자 목록 that FR-020-06 also asks for is a different thing with a different
source: it comes from Yorkie document presence and never crosses this API (§4.1, `lib/presence/`).
One requirement, two halves — the tree half is served here, the roster half is not.

### Documents

| Method | Path | Purpose | Auth | Traceability |
| --- | --- | --- | --- | --- |
| `POST` | `/api/documents` | Create a document or folder, resolving name collisions | guest | FR-021-01~05 |
| `PATCH` | `/api/documents/:id` | Rename or move to another folder | guest | FR-023-01~03 |
| `DELETE` | `/api/documents/:id` | Delete, cascading to child documents | guest | FR-023-04~06 |
| `POST` | `/api/documents/:id/files` | Upload a file to embed as a file block | guest | FR-022-13/14 |

Tree mutations are relayed to other clients over the workspace WebSocket (§4), not polled — FR-021-06 and FR-023-07 both require realtime reflection in every client's tree.

### Files

| Method | Path | Purpose | Auth | Traceability |
| --- | --- | --- | --- | --- |
| `GET` | `/api/files` | Workspace-wide list of embedded files, grouped by kind | guest | FR-050-01/02 |
| `GET` | `/api/files/:id/preview` | In-app preview render/stream | guest | FR-050-03, FR-080-01~03 |
| `GET` | `/api/files/:id/download` | Download the original bytes | guest | FR-050-04, FR-061-04, FR-080-05 |

File bytes never travel through Yorkie — blocks carry only a `fileId` reference (`document-editing.md` §8~10), so every read of actual content lands here.

Bytes live at `.data/files/<fileId>` and metadata in `.data/files/index.json`. **The id is the
filename on disk, never the uploaded name** — a name is attacker-controlled and `../../` is a
valid string. One store is shared with document files (FR-022-13/14) when those land, with an
`origin` field recording which; FR-050-06 and FR-061-01 are queries over it.

#### Why preview and download are two endpoints

Hosting user bytes on the app's own origin has one serious failure mode: **a file the browser
treats as active content**. An uploaded `.html` echoed back as `text/html` executes *in this
origin*, where the session cookie lives.

Blocking extensions at upload does not fix it — `.exe` is harmless at rest, `.html` renamed to
`.txt` slips through, and a blacklist has to stay right forever. The decision belongs where it
is decidable: **at serving time, from server-held state.** Two endpoints, so neither has to
branch on a stored value:

| | serves | `Content-Type` | `Content-Disposition` |
| --- | --- | --- | --- |
| `preview` | **only** `image/png\|jpeg\|gif\|webp` | the stored type | `inline` |
| `download` | anything | `application/octet-stream`, always | `attachment` |

`download` is safe because it has no branch to get wrong: it never reads the stored type, so no
upload can change the shape of its response, and a browser cannot render `octet-stream` as a
page. `preview` must name a real type for `<img>` to work, so it is the one that needs a list —
and the list is four literals rather than `startsWith("image/")` **because of SVG**:
`image/svg+xml` is an image that can carry `<script>`, and served `inline` it runs.

**Both responses carry `X-Content-Type-Options: nosniff`**, which is the other half. The stored
type is whatever the uploading client claimed, so an HTML file can be uploaded *as* `image/png`
and pass the list; `nosniff` stops the browser re-deciding from the bytes, so it tries to draw a
PNG, fails, and shows a broken image instead of a page. The list stops the server naming a
dangerous type; `nosniff` stops the browser overriding a safe one.

`filename*=UTF-8''…` is percent-encoded with CR/LF stripped, so a crafted name cannot inject a
header. This rule is [wafflebase](https://github.com/wafflebase/wafflebase)'s
`generic-file-upload.md`, which hit the problem first.

### Chat

Chat has two candidate implementations (§5). These REST endpoints belong to **version A**; the paths that survive under version B are marked.

| Method | Path | Purpose | Auth | Traceability | B? |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/chat` | Message history | guest | FR-060-05 | — |
| `POST` | `/api/chat` | Send and persist a message | guest | FR-060-01~03/05 | — |
| `POST` | `/api/chat/files` | Upload a file to attach to a message | guest | FR-060-02 | ✅ |
| `GET` | `/api/chat/files` | List files shared in chat | guest | FR-061-01/02 | ✅ |

`POST /api/chat/files` is not in the original draft but is unavoidable: chat attachments are bytes, and bytes cannot go through Yorkie, so both chat versions need this REST path even when version B carries the messages themselves over CRDT.

## 2. RPC — rmf-block-server ↔ Yorkie

| Direction | Call | Purpose | Traceability |
| --- | --- | --- | --- |
| Yorkie → server | `POST /internal/yorkie/auth` (auth webhook) | Yorkie asks us to authorize each client operation: validate the session token and check workspace membership plus document access | Execution arm of the FR-010/FR-020 auth chain, NFR-SEC-002/005 |
| Server → Yorkie | ~~`Watch`~~ — **decided: not kept** | This subscription existed only to drive the delayed-write trigger, which ADR-002 deletes; Mongo now provides durability directly, so nothing needs it | ADR-002 |
| Server → Yorkie | Admin API, read-only — document summaries and active editors | Supplementary source for who is editing what | FR-040 (support), FR-022-06 (support) |

**Implemented.** Yorkie's port is still published, but reaching it no longer gets anyone in:
without a token this server issued, a client is refused at `ActivateClient`, before it touches a
document. The chain is three parts — `GET /api/auth/yorkie-token` trades the session cookie for
something client JS can hold (the cookie is `httpOnly` so that page scripts, and anyone reading a
shared screen under UC-030, never see it), the browser passes that through the SDK's
`authTokenInjector`, and this webhook answers. Startup writes the webhook onto Yorkie's project
itself, over the Admin API, and refuses to serve if it cannot: the webhook URL is a project field
rather than a server flag, and a step the host could forget would make an unguarded Yorkie the
default.

The webhook asks two questions, not one. A token can be valid while the session behind it is
gone — a device displaced by another (FR-020-08) keeps its token — so tokens point at sessions and
the session is resolved separately. Refusals answer `401` with `{ allowed: false, reason }`; Yorkie
pairs status with body and accepts only `200`+allowed, `401`+refused, `403`+refused, reading
anything else as a malfunction rather than a refusal.

**The token-refresh question this section used to leave open is answered**: against the pinned
`@yorkie-js/sdk@0.7.13`, the SDK calls `authTokenInjector` again whenever the webhook refuses and
passes the refusal's own `reason` as its argument, then retries with what it gets back. So expiry
needs no timer on either side, and `reason` is a channel rather than a log line — `"token expired"`
means fetch another, `"session revoked"` means another will not help.

One thing worth knowing wherever revocation is being reasoned about: **Yorkie caches an auth
decision for ten seconds by default** (`--auth-webhook-cache-auth-ttl`). A guest removed through
UC-011 keeps whatever Yorkie last decided about them until that expires. Choosing the value is
[#48](https://github.com/CBNU-TeamH/RMF-Block/issues/48).

Document keys carry no type prefix — a Yorkie key can only contain `a-z A-Z 0-9 - . _ ~` (120 chars max), which rules out a `:`-delimited scheme and makes any other delimiter ambiguous against UUIDs. Instead the key **is** the document's id as issued by `POST /api/documents`, and the webhook resolves its type by looking the id up in the App/WS Server's own document table — which it already needs for the Document Tree API. `chat` is a reserved literal key (version B, §5) rather than an id, since it's a workspace-wide singleton.

## 3. RPC — yorkie-js-sdk ↔ Yorkie

Not our API to design — listed so the boundary is visible and each call is tied to a requirement.

| Call | Purpose | Traceability |
| --- | --- | --- |
| `ActivateClient` / `DeactivateClient` | Start and end a client session | FR-020-04 |
| `AttachDocument` / `DetachDocument` | Enter and leave a document editing session | Basis of all of FR-022 |
| `PushPullChanges` | CRDT change sync | FR-022-02~04/09/12 |
| `Watch` | Realtime change and presence stream | FR-022-06, FR-022-09 |
| `Broadcast` | Realtime messaging outside document content | Candidate for chat version B (§5) |
| Revision APIs (`createRevision`/`getRevision`/`listRevisions`/`restoreRevision`) | Yorkie-native version history — **the system's only history mechanism** since ADR-002. Snapshots come back as YSON | ADR-002; SOIR003, NFR-REL-002, NFR-SAF-003 |

Exact method names and availability must be confirmed against the pinned SDK version before implementation.

## 4. WebSocket — client ↔ rmf-block-server

For state that is neither request/response nor scoped to a single Yorkie document. SRS §2.1's component diagram already routes client traffic through this server as "API / 웹소켓 요청".

### 4.1 Workspace presence index (FR-040)

**Superseded in part.** The "who is connected" half shipped over Yorkie instead: every client
attaches to a reserved `workspace` document and reads `doc.getPresences()` (`lib/presence/`,
`app/(workspace)/presence-provider.tsx`). There is no server-held roster and no WS hub involvement — none of
the six events below exist in the code, and the `/api/workspace/ws` socket that does exist carries
`session:revoked` plus chat — `WsHub.broadcast()` writes to every open connection regardless of which
path it upgraded on, so a `chat:message` reaches workspace sockets as well and is ignored client-side. See the connected-user-list task under `tasks/` for why Yorkie won:
it already handles disconnect detection, which was the hard half.

What is **not** superseded is the `documentId` half — which document each connected user has open.
Yorkie presence is per-document, so nothing shipped answers that workspace-wide, and the index
below is still the design for it. Rewriting this section is FR-040's job, not a docs pass.

Yorkie presence is per-document, so it cannot answer "who is in this workspace and where". The server keeps a workspace-level index of `userId → documentId | null`.

| Direction | Event | Meaning |
| --- | --- | --- |
| client → server | `presence:enter` | Joining the workspace socket; server adds the user with `null` |
| client → server | `presence:attach` | Opened a document; server sets the value |
| client → server | `presence:detach` | Closed the document; server resets to `null` |
| client → server | *(socket close)* | Server removes the key entirely |
| server → all | `presence:sync` | Full index snapshot, on connect |
| server → all | `presence:changed` | One user's location changed |
| server → all | `presence:left` | A user's key was removed |

Presence in the index means connected; absence of the key means offline. That distinction is what FR-040-04 renders as the dimmed, unclickable state — no separate online flag.

### 4.2 Presentation session (FR-030) — draft, implementation deferred

Direction agreed, build postponed by team decision.

| Direction | Event | Meaning |
| --- | --- | --- |
| client (presenter) → server | `presentation:start` | Begin presenting a document |
| server → all | `presentation:started` | Announce presenter and document |
| client (presenter) → server | `presentation:end` | End the session |
| server → all | `presentation:ended` | Release followers |

The server only announces *who* is presenting. Followers then subscribe to that presenter's Yorkie presence on the shared document directly and pin their own view to it client-side — reusing the existing `Watch`/presence stream instead of relaying viewport state through this server. Pause and resume (FR-030-08) are a client-side toggle and need no server call.

Presenter highlight tools (FR-030-12/13) are not covered here and need their own design.

### 4.3 Chat realtime delivery (FR-060-04)

See §5 — the events depend on which chat version is in use. Under version A the server broadcasts `chat:message` to every workspace socket after persisting; under version B this server carries no chat traffic at all.

## 5. Chat — two candidate implementations

FR-060 was designed as two candidates, as agreed: one conventional, one Yorkie-native. A shared client-facing interface is preferred but not required if the two diverge. **Version A has shipped** (`lib/chat/`, `20260812-chat-service`); Version B remains an unstarted proposal below, not a second implementation in progress.

**Version A — server module (REST + WebSocket)**

`POST /api/chat` persists, then the server broadcasts `chat:message` to every socket in the workspace. Reconnecting clients backfill through `GET /api/chat`. The server owns ordering and delivery guarantees. Conventional and predictable.

**Version B — Yorkie document module**

One dedicated Yorkie document per workspace (reserved key `chat`) holding messages as a CRDT array. Clients attach to it like any other document and send by updating it; delivery rides `PushPullChanges`/`Watch`, so **rmf-block-server relays nothing**. Persistence comes free from the Yorkie storage already in place, satisfying FR-060-05 without a chat table.

Version B requires the auth webhook's access check (§2) to recognize the literal `chat` key ahead of the document-table lookup. File attachments still upload over REST either way.

## Open questions
- Whether the two chat versions can share one client-facing interface.
- Presenter highlight tooling (FR-030-12/13).
