# API Design — Endpoint Catalog

- **Status**: Draft. Endpoints only — no request/response schemas yet. Shipped so far: `/api/auth/host` (as a simplified interim `GET` + query param, not the `POST` below — see `app/api/auth/host/route.ts`), `/api/workspace/join`, `/api/chat`, `/api/chat/files`, `/api/documents/:id/files` (PDFs only, see below), `/api/files/:id/preview`, `/api/files/:id/download`, plus two endpoints this catalogue does not list because they are not client-facing: `/api/auth/yorkie-token` (issues a per-session token) and `/api/internal/yorkie/auth` (the webhook Yorkie itself calls). Every other row below is target design, not yet built.
- **Owns**: `lib/auth/`, `lib/workspace-config.ts`, `lib/yorkie-admin.ts`,
  `app/api/auth/host/route.ts`, `app/api/auth/yorkie-token/route.ts`,
  `app/api/internal/yorkie/auth/route.ts`, `app/api/workspace/join/route.ts`,
  `app/session-watch.tsx` — the "Authentication model" section below is where their shape
  (bootstrap secret, session tokens, restart-is-the-revoke-path, the webhook that makes Yorkie
  ask at all) is explained; nothing else in `docs/design/` covers them. The route handlers are
  the endpoints §1 already tabulates, so this doc owning them keeps the contract and its
  implementation described in one place.
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

Tokens live in memory, like the sessions they point at. A bearer token written to the host's disk
outlives the reason it was issued, and restarting the container is this project's documented
revoke path — a token that survived the restart would defeat it.
[`#47`](https://github.com/CBNU-TeamH/RMF-Block/issues/47) weighs that against a signed token the
webhook could verify with no table at all.

### The pieces around it

Three files carry parts of this model that no endpoint row shows.

`lib/workspace-config.ts` reads the workspace name and access password the host sets before
starting the server (FR-020-02). It is configuration, not state: the password is never written to
`.data/`, and changing it means restarting with a different value.

`lib/yorkie-admin.ts` registers this server's auth webhook with Yorkie at startup
(NFR-SEC-002/005). It is what makes §2's webhook actually get called — a Yorkie that was never
told to ask would accept any client that can reach port 8080, which is the failure
`instrumentation.ts` refuses to boot past.

`app/session-watch.tsx` is the client half of FR-020-08's one-device rule: when a nickname is
claimed on another device, the displaced session is revoked server-side and this component is
what notices and leaves the workspace, rather than leaving a dead tab showing stale content.

### What the session registry decides

The password check is deliberately **not** in `lib/auth/session-registry.ts`. It runs only after
the caller has accepted the password, so nothing in it can leak whether a guess was close, and the
takeover rules stay testable without an HTTP request.

**It is bounded.** Every distinct nickname adds a member that is never removed, so without a
ceiling a guest who knows the password could spend the process's memory one join at a time. SRS
§2.4 sizes a workspace at 8 people; `MAX_MEMBERS` leaves room for nicknames changing their mind
through a session and still bounds the damage.

**A failed write rolls back only for a new member.** The two cases are not the same failure. A
returning member is already on disk, so a failed write costs only a fresher `lastJoinedAt` — the
state this app ran in before members persisted at all. A brand-new member was never durable, and
every mutation belongs to that one call (they cannot have displaced anyone, so there is nothing to
put back); leaving those in place would strand a session nobody holds, and the nickname would read
as taken until the process restarted.

**Detecting a takeover reads `memberBySession`, not `sessionByMemberId`.** The latter keeps the
newest id forever and would call anyone who ever joined "live". Only the session map still
resolving an id means live — which is exactly what a takeover deletes. The registry cannot tell
one person's second device from two people picking the same name, so the route asks rather than
guessing.

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

`lastJoinedAt` is deliberately **not** on `WorkspaceMember`, only on the stored record (`StoredMember`). `WorkspaceMember` is also the presence payload every browser publishes to every other (`lib/presence/types.ts`), so a field added there is broadcast to the whole workspace — and when someone last signed in is nobody else's business. The host reads it on the Members screen as 최근 접속, server-side.

`GET /api/workspace`'s members are **who belongs to this workspace**, not who is online — the
persistent record `.data/` keeps so a kick (`DELETE …/members/:userId`) and a restore have something
to act on. The live 접속자 목록 that FR-020-06 also asks for is a different thing with a different
source: it comes from Yorkie document presence and never crosses this API (§4.1, `lib/presence/`).
One requirement, two halves — the tree half is served here, the roster half is not.

### Documents

| Method | Path | Purpose | Auth | Traceability | Status |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/documents` | Create a document or folder, resolving name collisions | guest | FR-021-01~05 | ✅ |
| `PATCH` | `/api/documents/:id` | Rename or move to another folder | guest | FR-023-01~03 | |
| `DELETE` | `/api/documents/:id` | Delete, cascading to child documents | guest | FR-023-04~06 | |
| `POST` | `/api/documents/:id/files` | Upload a file to embed as a file block | guest | FR-022-13/14 | ✅ PDF only |

Tree mutations are relayed to other clients over the workspace WebSocket (§4), not polled — FR-021-06 and FR-023-07 both require realtime reflection in every client's tree.

`POST /api/documents/:id/files` **accepts PDFs and refuses everything else (415)**, and
decides that from the bytes (`%PDF-`) rather than the client's claimed MIME type. FR-022-14
dispatches five kinds into three block types and only the PDF block has a renderer today, so
accepting the rest would store bytes no block can display. It stores the file with
`origin: "document"` and `type: "application/pdf"` — a type this server verified, not one it was
told — and returns the metadata; the client then puts the `fileId` on the block it creates.
Every check on the request itself (declared length, 25 MB cap, the `file` field) is shared with
`POST /api/chat/files` in `lib/files/upload.ts`.

### Files

| Method | Path | Purpose | Auth | Traceability | Status |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/files` | Workspace-wide list of embedded files, grouped by kind | guest | FR-050-01/02 | |
| `GET` | `/api/files/:id/preview` | In-app preview render/stream | guest | FR-050-03, FR-080-01~03 | ✅ images + PDF |
| `GET` | `/api/files/:id/download` | Download the original bytes | guest | FR-050-04, FR-061-04, FR-080-05 | ✅ |

File bytes never travel through Yorkie — blocks carry only a `fileId` reference (`document-editing.md` §8~10), so every read of actual content lands here.

Bytes live at `.data/files/<fileId>` and metadata in `.data/files/index.json`. **The id is the
filename on disk, never the uploaded name** — a name is attacker-controlled and `../../` is a
valid string. One store is shared with document files (FR-022-13/14) when those land, with an
`origin` field recording which; FR-050-06 and FR-061-01 are queries over it.

File responses are `Cache-Control: private`. They cross a LAN that may have caches of its own in front of them, and a file belongs to one workspace — `private` keeps a shared cache from holding one and serving it on.

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
| `preview` | **only** `image/png\|jpeg\|gif\|webp` and `application/pdf` | the stored type | `inline; filename*=…` |
| `download` | anything | `application/octet-stream`, always | `attachment; filename*=…` |

`download` is safe because it has no branch to get wrong: it never reads the stored type, so no
upload can change the shape of its response, and a browser cannot render `octet-stream` as a
page. `preview` must name a real type for `<img>` or `<iframe>` to work, so it is the one that
needs a list — and the list is literals rather than `startsWith("image/")` **because of SVG**:
`image/svg+xml` is an image that can carry `<script>`, and served `inline` it runs.

`application/pdf` is on that list so the PDF block can hold an `<iframe>` of it
(FR-080-01~03) — every browser in `docs/SRS-ko.md` §4.2 has its own PDF viewer, which is why
this needs no PDF library. A PDF's own scripting runs inside that viewer, not in this origin,
which is the difference from SVG. The declared `Content-Type` is what routes a response to that
viewer during serving; `nosniff` below is what stops the browser re-deciding that type from the
bytes, not what does the routing itself. A file that is *not* a PDF, served under a declared
`application/pdf`, still does not become one: the viewer opens for it anyway and fails to parse,
showing an error rather than falling through to the HTML parser.

That declared type is only trustworthy where something checked it. For a **document** upload the
endpoint stores `application/pdf` solely for bytes that start with `%PDF-`, so the label there is
server-verified. A **chat** attachment carries no such check — its type is whatever the
uploader's browser claimed (`docs/design/chat.md`'s message shape) — so this guarantee does not extend to
every file `preview`/`download` serve, only to the ones a document upload produced.

**Both responses carry `X-Content-Type-Options: nosniff`**, which is the other half. The stored
type is whatever the uploading client claimed, so an HTML file can be uploaded *as* `image/png`
and pass the list; `nosniff` stops the browser re-deciding from the bytes, so it tries to draw a
PNG, fails, and shows a broken image instead of a page. The list stops the server naming a
dangerous type; `nosniff` stops the browser overriding a safe one.

`filename*=UTF-8''…` is percent-encoded with CR/LF stripped, so a crafted name cannot inject a
header. It is sent **alone**, without an ASCII `filename=` beside it: every browser
`docs/SRS-ko.md` §4.2 supports reads `filename*`, and a second copy of the name would be a second
thing to escape correctly. This rule is [wafflebase](https://github.com/wafflebase/wafflebase)'s
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

Anything outside those three combinations — a `200` carrying `allowed: false` included — becomes `ErrInvalidJSONResponse` on Yorkie's side (`server/rpc/auth/webhook.go`), a malfunction rather than a refusal. `401` is chosen over `403` because both refusals here are about identity rather than permission, and because it is the branch Yorkie does **not** cache: a refusal is re-asked rather than pinned for the cache TTL.

The endpoint is deliberately unsigned. Anything on the LAN can call it, and all a caller can learn is whether a token it already holds is valid.

**The token-refresh question this section used to leave open is answered**: against the pinned
`@yorkie-js/sdk@0.7.13`, the SDK calls `authTokenInjector` again whenever the webhook refuses and
passes the refusal's own `reason` as its argument, then retries with what it gets back. So expiry
needs no timer on either side, and `reason` is a channel rather than a log line — `"token expired"`
means fetch another, `"session revoked"` means another will not help.

**A session that already holds a live token gets that one back**, rather than a freshly minted
one. This is what bounds the registry. `authTokenInjector` runs on *every* refusal, so a session
whose requests keep being refused — a clock skew, a webhook fault — would fetch in a loop, and
minting per call would leave an entry behind each time, for an hour. `SessionRegistry` bounds the
same shape with an explicit `MAX_MEMBERS` ceiling; here the bound falls out for free, because
there is no reason for one session to hold two tokens. Expired entries are pruned at issue time
for the same reason — issuing is the only moment the map grows, so a timer would be a second
thing to keep alive for no gain.

Two tabs therefore share a token, which is correct: the token authorizes a *session*, and both
tabs are that session. Handing back a token with minutes left on it is fine too, since the SDK
asks for a replacement the moment the webhook refuses one.

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
