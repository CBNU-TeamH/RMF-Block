# API Design — Endpoint Catalog

- **Status**: Draft. Endpoints only — no request/response schemas yet. What is built is §1's generated table; the hand-written tables after it are target design. `/api/auth/host` is built as a simplified interim `GET` + query param, not the `POST` the target table lists — see `app/api/auth/host/route.ts`.
- **Owns**: `lib/auth/`, `lib/workspace-config.ts`, `lib/yorkie-admin.ts`,
  `app/api/auth/host/route.ts`, `app/api/auth/yorkie-token/route.ts`,
  `app/api/internal/yorkie/auth/route.ts`, `app/api/workspace/join/route.ts`,
  `app/api/workspace/route.ts`, `app/api/workspace/password/route.ts`,
  `app/api/workspace/members/[id]/route.ts`, `app/admin/page.tsx`, `app/admin/admin-forms.tsx`,
  `app/session-watch.tsx`, `app/join/page.tsx`, `app/join/join-form.tsx` — the "Authentication model" section below is where their shape
  (bootstrap secret, session tokens, restart-is-the-revoke-path, the webhook that makes Yorkie
  ask at all) is explained; nothing else in `docs/design/` covers them. The route handlers are
  the endpoints §1 already tabulates, so this doc owning them keeps the contract and its
  implementation described in one place.
- **Related**: [`docs/design/architecture.md`](architecture.md) §3(b); [`docs/adr/002-persistence-on-yorkie-mongo.md`](../adr/002-persistence-on-yorkie-mongo.md); [`docs/adr/006-workspace-chat-socket-auth.md`](../adr/006-workspace-chat-socket-auth.md); [`docs/SRS-ko.md`](../SRS-ko.md) §3.2, §3.3

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

**Shipped today is narrower than the model below.** A join issues one opaque `randomUUID()` session id held
in an in-memory `Map` (`lib/auth/session-registry.ts`) and set as a cookie with no `maxAge` — no
expiry, no rotation, no refresh endpoint, no reuse detection. The stdout bootstrap secret,
restart-is-revoke and the one-hour in-memory Yorkie tokens are built; the 30-minute/7-day
access + refresh pair, token-family invalidation and the host session token are target design.

Access tokens live 30 minutes; refresh tokens live 7 days. Refresh-token reuse is treated as a theft signal: it invalidates the token family and forces the host to re-read the bootstrap secret from stdout.

Rotation bounds how long a leaked token stays replayable. It does **not** protect against a token leaking live — most plausibly by appearing in the address bar during screen sharing (UC-030) — so the client strips the token from the URL immediately after handoff and keeps it out of persistent storage. LAN traffic is unencrypted, so rotation narrows the replay window rather than preventing interception.

There is no separate "revoke all sessions" endpoint. The host runs the container directly, so restarting it is the revoke path: a fresh bootstrap secret is printed to stdout and every existing session token is invalidated (unless `HOST_SECRET` is pinned in the environment, which keeps the old secret, and so the host's `role` cookie, valid). Adding a dedicated revoke action would duplicate that and overlap with the per-guest kick (`DELETE /api/workspace/members/:userId`): `sessionRegistry.kick()` drops one live session (the member record stays — UC-011 is not a ban), `wsHub.revoke(sessionId, "kicked")` tells that guest's sockets why before closing them, and the auth webhook refuses their Yorkie token from the next check on — within the webhook cache TTL, see the Yorkie section.

Tokens live in memory, like the sessions they point at. A bearer token written to the host's disk
outlives the reason it was issued, and restarting the container is this project's documented
revoke path — a token that survived the restart would defeat it.
[`#47`](https://github.com/CBNU-TeamH/RMF-Block/issues/47) weighs that against a signed token the
webhook could verify with no table at all.

### The pieces around it

Three files carry parts of this model that no endpoint row shows.

`lib/workspace-config.ts` holds the workspace name and access password (FR-010-01/02,
FR-020-02). They are state, in `.data/workspace.json`: the host sets them on the admin page's setup
screen (`POST /api/workspace`), changes the password there without a restart
(`PATCH /api/workspace/password`, FR-011-04~06 — nothing in the session registry is touched, so
connected users stay), and a restart resumes them (FR-010-05). The password is stored as a scrypt
hash with its salt, never as itself, and compared in constant time (async scrypt, so a join
never stalls the process). For development and CI, startup writes `WORKSPACE_PASSWORD`/`WORKSPACE_NAME`
into the file when it does not exist yet (`seedWorkspaceFromEnv()`); once it exists they are never
read. A file that does not parse, or lacks a valid salt and 64-hex hash, counts as not set up (logged
once) rather than an error — the setup screen rewriting it is the recovery, where throwing would
fail every page; `PATCH /api/workspace/password` refuses before setup (409) so it cannot create the
workspace and skip the name. The server boots either way — `/join` answers 503 until the workspace is open, and
startup prints that setup is unfinished.

`lib/yorkie-admin.ts` registers this server's auth webhook with Yorkie at startup
(NFR-SEC-002/005). It is what makes §2's webhook actually get called — a Yorkie that was never
told to ask would accept any client that can reach port 8080.

`app/session-watch.tsx` is the client half of FR-020-08's one-device rule: when a nickname is
claimed on another device, the displaced session is revoked server-side and this component is
what notices and leaves the workspace, rather than leaving a dead tab showing stale content.

### Entry gotchas

Three things about the host/guest entry flow that only show up in the container.

`GET /api/auth/host` answers with a **relative** `Location: /`, not
`NextResponse.redirect(new URL("/", request.url))`. The container runs with `HOSTNAME=0.0.0.0`, so
`request.url` is `http://0.0.0.0:3000/…` — a different origin from the one the host typed, and the
browser drops the cookie that response just set.

`HOST_LAN_IP` is read with `||`, not `??`: compose passes it through as `""` when unset, and `??`
lets the empty string through as an address.

A Docker/NAT-range address is never printed as the guest join address (`isNatRange`,
`lib/lan-address.ts`) — it reaches nobody on the LAN. The banner names it and says how to set the
real one instead.

### The document endpoints

`POST /api/documents` takes an optional `parentId` (UC-021 E1a); absent or `null` is the root.
`GET` returns the whole catalogue, for a client that needs it after first paint — the `/` menu's
document picker. The workspace page is a server component and reads the store directly instead.

`PATCH /api/documents/:id` carries **either** a `name` or a `parentId`, never both. They are two
operations with opposite collision rules — FR-023-02 refuses a name a sibling already holds, while
a move *suffixes* one — and a request doing both would have to pick which rule applies. Sending
neither, or both, is a 400.

The asymmetry is deliberate. A suffix on create is the system helping; the same suffix on a rename
would overrule a name the person just typed, so a rename says no and asks again.

`DELETE /api/documents/:id` removes the document **and its whole subtree in one write**
(FR-023-06), and answers with every id it removed. A cascade that failed half way would leave
children whose parent is gone; one write either happened or did not.

A move into the document's own subtree is refused. Nothing in the SRS forbids it, because nobody
writes down that a document cannot be its own grandparent — but a UI that lets a person drag a
parent onto its own child produces exactly that, and the loop it makes is unreachable from the
root: invisible in the tree, and gone from every view that renders one.

### What the join route answers with

A nickname someone is still signed in under comes back as **409**, not a silent takeover. The
client asks the person and retries with `force: true`. That check runs **after** the password
check, never before: the 409 is the one response that confirms a nickname is in use, so only
someone already inside may see it.

A wrong password names *the password* in its message. An unknown nickname is not a failure on this
route — it becomes a new member — so this branch can only mean one thing.

Any other failure returns a body the form can render, not Next's own 500 page, which the join form
would read as `"서버에 연결할 수 없습니다"` and so blame the network for a fault on the server.

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

### Implemented endpoints (generated)

<!-- generated:endpoints:start -->
Generated by `node scripts/gen-endpoints.mjs` from the code — do not edit by hand.

| Method | Path | Handler file | Client callers |
| --- | --- | --- | --- |
| `GET` | `/api/auth/host` | `app/api/auth/host/route.ts` | — (no fetch caller; used as a URL) |
| `GET` | `/api/auth/yorkie-token` | `app/api/auth/yorkie-token/route.ts` | `app/(workspace)/presence-provider.tsx` |
| `GET` | `/api/chat` | `app/api/chat/route.ts` | `app/(workspace)/chat-panel.tsx` |
| `POST` | `/api/chat` | `app/api/chat/route.ts` | `app/(workspace)/chat-panel.tsx` |
| `POST` | `/api/chat/files` | `app/api/chat/files/route.ts` | `app/(workspace)/chat-panel.tsx` |
| `WS` | `/api/chat/ws` | `server/index.mts` | `app/(workspace)/chat-panel.tsx` |
| `GET` | `/api/documents` | `app/api/documents/route.ts` | `app/(workspace)/documents/[id]/editor.tsx`, `app/(workspace)/floating-views.tsx` |
| `POST` | `/api/documents` | `app/api/documents/route.ts` | `app/(workspace)/document-list.tsx`, `app/(workspace)/documents/[id]/editor.tsx` |
| `DELETE` | `/api/documents/[id]` | `app/api/documents/[id]/route.ts` | `app/(workspace)/document-actions.tsx` |
| `GET` | `/api/documents/[id]` | `app/api/documents/[id]/route.ts` | `app/(workspace)/documents/[id]/doc-link-block.tsx` |
| `PATCH` | `/api/documents/[id]` | `app/api/documents/[id]/route.ts` | `app/(workspace)/document-actions.tsx` |
| `POST` | `/api/documents/[id]/files` | `app/api/documents/[id]/files/route.ts` | `app/(workspace)/documents/[id]/use-file-upload.ts` |
| `GET` | `/api/files/[id]/download` | `app/api/files/[id]/download/route.ts` | — (no fetch caller; used as a URL) |
| `GET` | `/api/files/[id]/preview` | `app/api/files/[id]/preview/route.ts` | — (no fetch caller; used as a URL) |
| `POST` | `/api/internal/yorkie/auth` | `app/api/internal/yorkie/auth/route.ts` | — (webhook) |
| `POST` | `/api/workspace` | `app/api/workspace/route.ts` | `app/admin/admin-forms.tsx` |
| `POST` | `/api/workspace/join` | `app/api/workspace/join/route.ts` | `app/join/join-form.tsx` |
| `DELETE` | `/api/workspace/members/[id]` | `app/api/workspace/members/[id]/route.ts` | `app/admin/admin-forms.tsx` |
| `PATCH` | `/api/workspace/password` | `app/api/workspace/password/route.ts` | `app/admin/admin-forms.tsx` |
| `WS` | `/api/workspace/ws` | `server/index.mts` | `app/(workspace)/document-list.tsx`, `app/(workspace)/floating-views.tsx`, `app/session-watch.tsx` |
<!-- generated:endpoints:end -->

### Target design

The tables below are the target design, not the built set — the generated table above is what exists. `host` in the Auth column means host-only; FR-011-07 requires the server to reject these from anyone else.

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
| `GET` | `/api/documents` | The whole catalogue | guest | — | ✅ |
| `POST` | `/api/documents` | Create a document or folder, resolving name collisions | guest | FR-021-01~05 | ✅ |
| `GET` | `/api/documents/:id` | One document's catalogue row — what a `doc-link` block reads to show a name | guest | — | ✅ |
| `PATCH` | `/api/documents/:id` | Rename or move to another folder | guest | FR-023-01~03 | ✅ |
| `DELETE` | `/api/documents/:id` | Delete, cascading to child documents | guest | FR-023-04~06 | ✅ |
| `POST` | `/api/documents/:id/files` | Upload a file to embed as a block | guest | FR-022-13/14 | ✅ |

Tree mutations are relayed to other clients over the workspace WebSocket (§4), not polled — FR-021-06 and FR-023-07 both require realtime reflection in every client's tree.

`POST /api/documents/:id/files` **accepts any file, and decides what it is from the bytes** —
never from the client's claimed MIME type or the file's name. `%PDF-` makes it a PDF; the magic
number of PNG, JPEG, GIF or WebP makes it that image; **everything else is stored as
`application/octet-stream`**, which is what a file block holds (FR-022-13).

The sniffing is not a nicety. `GET /api/files/:id/preview` answers `inline` for any file whose
**stored** type is in `serving.ts`'s `INLINE_TYPES`, so a stored type the uploader chose would be
a way to have an HTML page served as an image and run. Verified: an HTML file renamed `.png` is
stored as `octet-stream`, and `preview` then answers 404 for it.

SVG is deliberately not an image here. It is XML that can carry `<script>`, so it is not in
`INLINE_TYPES` and becomes a file block — a download card, never a preview. The same is true of
the Word, PPT and Excel types FR-022-14 names: this project has no viewer for them, and
`download` is unconditional `octet-stream` + `attachment`, so nothing a file block points at can
render or run.

It stores the file with `origin: "document"` and the verified type, and returns the metadata; the
client then puts the `fileId` on the block it creates, choosing the block from the **returned
type**, which is the only one of name, claim and content that was checked.
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
`origin` field recording which; FR-050-06 is a query over it. FR-061-01's chat file list is not:
it is derived from the chat history ([`chat.md`](chat.md#the-file-list)).

**Two ceilings, not one.** An upload is refused at 25 MB, and that number is about the *file*, which
is what the error message says. The request carrying it is larger: `content-length` covers the whole
`multipart/form-data` body — boundary lines, each part's headers, the CRLFs. So the declared length
is measured against its own slightly higher ceiling, and only the parsed `file.size` is measured
against 25 MB. The first check exists to bound what `formData()` will buffer, not to decide the
verdict; collapsing them onto one constant is what made a file of exactly 25 MB fail
([#57](https://github.com/CBNU-TeamH/RMF-Block/issues/57)), and raising that one constant instead
would have admitted a genuinely oversized file.

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

`POST /api/chat/files` is not in the original draft but is unavoidable: chat attachments are bytes, and bytes cannot go through Yorkie, so both chat versions need this REST path even when version B carries the messages themselves over CRDT.

## 2. RPC — rmf-block-server ↔ Yorkie

| Direction | Call | Purpose | Traceability |
| --- | --- | --- | --- |
| Yorkie → server | `POST /api/internal/yorkie/auth` (auth webhook) | Yorkie asks us to authorize each client operation: validate the token and that its session is still live (workspace-membership and per-document access checks are not built) | Execution arm of the FR-010/FR-020 auth chain, NFR-SEC-002/005 |
| Server → Yorkie | ~~`Watch`~~ — **decided: not kept** | This subscription existed only to drive the delayed-write trigger, which ADR-002 deletes; Mongo now provides durability directly, so nothing needs it | ADR-002 |
| Server → Yorkie | Admin API, read-only — document summaries and active editors | Supplementary source for who is editing what | FR-040 (support), FR-022-06 (support) |

**Implemented.** Yorkie's port is still published, but reaching it no longer gets anyone in:
without a token this server issued, a client is refused at `ActivateClient`, before it touches a
document. The chain is three parts — `GET /api/auth/yorkie-token` trades the session cookie for
something client JS can hold (the cookie is `httpOnly` so that page scripts, and anyone reading a
shared screen under UC-030, never see it), the browser passes that through the SDK's
`authTokenInjector`, and this webhook answers. The host has no workspace session, so the
`role` cookie is exchanged under the `host:<secret>` prefix (`HOST_SESSION_PREFIX`) and the
webhook allows such a token without a session lookup; revoking the host is the restart, which
clears the secret and the token registry together. Startup writes the webhook onto Yorkie's project
itself, over the Admin API: the webhook URL is a project field
rather than a server flag, and a step the host could forget would make an unguarded Yorkie the
default.

The webhook asks two questions, not one. A token can be valid while the session behind it is
gone — a device displaced by another (FR-020-08) keeps its token — so tokens point at sessions and
the session is resolved separately. Refusals answer `401` with `{ allowed: false, reason }`; Yorkie
pairs status with body and accepts only `200`+allowed, `401`+refused, `403`+refused, reading
anything else as a malfunction rather than a refusal.

Anything outside those three combinations — a `200` carrying `allowed: false` included — becomes `ErrInvalidJSONResponse` on Yorkie's side (`server/rpc/auth/webhook.go`), a malfunction rather than a refusal. `401` is chosen over `403` because both refusals here are about identity rather than permission, and because it is the branch Yorkie does **not** cache: a refusal is re-asked rather than pinned for the cache TTL.

An *allow* is cached, for `--auth-webhook-cache-auth-ttl` — set to `1s` in `docker-compose.yml` rather than Yorkie's 10s default (#48). That number is how long a kicked guest can keep writing: their session is gone, but Yorkie has not asked again yet. One second still absorbs the several `PushPull`s a second that typing produces, and the call is local to the compose network, so the cache saves almost nothing worth ten seconds of a kick that has not taken effect.

The endpoint is deliberately unsigned. Anything on the LAN can call it, and all a caller can learn is whether a token it already holds is valid.

**The app registers the webhook with Yorkie itself, at startup, and refuses to run if it cannot** (production; `pnpm dev` only warns).
The webhook URL is a Yorkie **project** field, not a server flag — `cmd/yorkie/server.go` exposes
only the cache size and TTL — so something has to call the Admin API after Yorkie is up. Leaving
that to the host would make `docker compose up` two steps and, worse, would make *an unguarded
Yorkie* the state you get by forgetting the second one.

It exits with `process.exit`, not `throw`. Throwing was the first attempt and does not work: Next
installs its own `unhandledRejection` listener, so a throw from `instrumentation.ts` is logged and
swallowed, `app.prepare()` never rejects, and the process lives on without ever listening — measured
at forty-five seconds of sitting there. In a container that is the worst outcome available, because
Docker sees a running service, `restart` never fires, and compose reports no failure while the
workspace looks up and serves nothing.

In development it is not fatal — Yorkie is often simply not running and most work does not need
it — but it is printed loudly, because this is the one state where the app looks fine and is
protecting nothing. The successful registration is printed too: Yorkie stores the webhook URL
without ever testing it, so an address it cannot reach registers exactly like one it can and
surfaces only later as clients failing with `verify access: send webhook`, which reads like a Yorkie
fault rather than a wrong address.

The Admin API is connect-protocol over HTTP/JSON, so this needs no client library (the JS SDK
ships none): log in for a token, then update the project. The URL is written from where **Yorkie**
stands, not where a browser does — inside compose that is the app's service name, since
`localhost` would be Yorkie's own container.

`ActivateClient` is the operation that matters most: refusing it stops a client before it reaches
any document at all, and the rest are defence in depth. Method names come from
`api/types/auth_webhook.go` — it is `WatchDocument`, singular, and an unknown name fails the
update rather than being ignored.

**Token refresh needs no timer**: the SDK calls `authTokenInjector` again whenever the webhook
refuses and passes the refusal's own `reason` as its argument, then retries with what it gets back. So expiry
needs none on either side, and `reason` is a channel rather than a log line — `"token expired"`
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

One thing worth knowing wherever revocation is being reasoned about: **Yorkie caches an allow
for `--auth-webhook-cache-auth-ttl`, 1s here** (the reasoning is under the webhook above; a refusal
is never cached). A guest removed through UC-011 can keep writing for up to that second.

Document keys carry no type prefix — a Yorkie key can only contain `a-z A-Z 0-9 - . _ ~` (120 chars max), which rules out a `:`-delimited scheme and makes any other delimiter ambiguous against UUIDs. Instead the key **is** the document's id as issued by `POST /api/documents`. The webhook does not read the key today; once it checks document access it would resolve the type by looking the id up in the App/WS Server's own document table, and `chat` would be a reserved literal key (version B, §5) rather than an id, since it's a workspace-wide singleton.

## 3. RPC — yorkie-js-sdk ↔ Yorkie

Not our API to design — listed so the boundary is visible and each call is tied to a requirement.

| Call | Purpose | Traceability |
| --- | --- | --- |
| `ActivateClient` / `DeactivateClient` | Start and end a client session | FR-020-04 |
| `AttachDocument` / `DetachDocument` | Enter and leave a document editing session | Basis of all of FR-022 |
| `PushPullChanges` | CRDT change sync | FR-022-02~04/09/12 |
| `Watch` | Realtime change and presence stream | FR-022-06, FR-022-09 |
| `Broadcast` | Realtime messaging outside document content | Candidate for chat version B (§5) |
| Revision APIs | Yorkie-native version history; which calls are used is in [`version-history.md`](version-history.md) | ADR-002; SOIR003, NFR-REL-002, NFR-SAF-003 |

## 4. WebSocket — client ↔ rmf-block-server

For state that is neither request/response nor scoped to a single Yorkie document. SRS §2.1's component diagram already routes client traffic through this server as "API / 웹소켓 요청".

Both sockets (`/api/chat/ws`, `/api/workspace/ws`) refuse the upgrade with a raw `401` unless a live session or the host secret is presented ([ADR-006](../adr/006-workspace-chat-socket-auth.md)).

### 4.1 Workspace presence index (FR-040)

Yorkie owns the roster: every client attaches to a reserved `workspace` document and reads
`doc.getPresences()` (`lib/presence/`, `app/(workspace)/presence-provider.tsx`), which also
handles disconnect detection. There is no server-held roster. The `/api/workspace/ws` socket
carries `session:revoked` plus chat — `WsHub.broadcast()` writes to every open connection
regardless of which path it upgraded on, so a `chat:message` reaches workspace sockets as well
and is ignored client-side.

Which document each user has open (UC-040) rides the same channel: the workspace presence
carries `location: { documentId, blockId } | null`, set from the route and the focused block, so
it vanishes with the connection and needs no server event. Members who are not connected come
from `.data/members.json` (`sessionRegistry.members()`), not from presence.

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

Which events flow, if any, depends on the chat version in use: [§5](#5-chat--two-candidate-implementations) owns the Version A/B split and the open question.

## 5. Chat — two candidate implementations

FR-060 was designed as two candidates, as agreed: one conventional, one Yorkie-native. A shared client-facing interface is preferred but not required if the two diverge. **Version A has shipped** (`lib/chat/`, `20260812-chat-service`); Version B remains an unstarted proposal below, not a second implementation in progress.

**Version A — server module (REST + WebSocket)**

`POST /api/chat` persists, then the server broadcasts `chat:message` to every socket in the workspace. Reconnecting clients backfill through `GET /api/chat`. The server owns ordering and delivery guarantees. Conventional and predictable.

**Version B — Yorkie document module**

One dedicated Yorkie document per workspace (reserved key `chat`) holding messages as a CRDT array. Clients attach to it like any other document and send by updating it; delivery rides `PushPullChanges`/`Watch`, so **rmf-block-server relays nothing**. Persistence comes free from the Yorkie storage already in place, satisfying FR-060-05 without a chat table.

Version B would need the auth webhook (§2, which does not look at document keys yet) to recognize the literal `chat` key ahead of any document-table lookup. File attachments still upload over REST either way.

## Open questions
- Whether the two chat versions can share one client-facing interface.
- Presenter highlight tooling (FR-030-12/13).
