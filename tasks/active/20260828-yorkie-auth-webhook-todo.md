# Gate Yorkie behind the workspace session

**Created**: 2026-08-28
**Issue**: —
**Design**: [`docs/design/api.md`](../../docs/design/api.md) §2 catalogues
`POST /internal/yorkie/auth` and calls it "Not implemented". This builds it. No new
design doc: the endpoint's contract is Yorkie's, not ours, and the parts `api.md` leaves
open are decided below.

## Goal

Close the hole `api.md` §2 names: Yorkie is published on the LAN and the session cookie
gates the Next.js routes only, so **anything that can reach port 8080 attaches to any
document with no session check.**

> ```js
> new yorkie.Client({ rpcAddr: "http://192.168.0.14:8080" }).activate()
> ```
> No nickname, no workspace password.

Harmless today — presence is all that rides on Yorkie, so the worst a stranger learns is
a list of nicknames. It stops being harmless the moment the editor puts document content
there, which is the next branch. Doing it after would mean unpicking a sync path that
already works.

Out of scope: per-document permissions (every member may edit everything — FR-022-06 and
SIR003 both say occupancy does not block editing), and the host/guest distinction inside
Yorkie (UC-011's kick acts through the app, not through Yorkie's ACL).

## What was verified first

`api.md` asks for exactly one thing before this is built:

> How the SDK re-supplies a rotated token needs verifying against the pinned
> `@yorkie-js/sdk` version before the Sync module is built.

Run against `yorkieteam/yorkie:0.7.13` on `mongo:8` with a throwaway webhook:

1. **The Admin API is reachable over plain HTTP/JSON.** It is connect-protocol, so
   `POST /yorkie.v1.AdminService/LogIn` with `Content-Type: application/json` works with
   no client library — the JS SDK ships no admin client. The header must be
   `Authorization: Bearer <token>`; without the scheme it answers *invalid authorization
   header format*. Default credentials are `admin`/`admin`, and the default project's id
   is `000000000000000000000000`.
2. **The webhook gates access.** With `authWebhookMethods` set, a client holding an
   accepted token attaches and syncs; a wrong token and an absent token are both refused
   at `ActivateClient`, before any document is touched. Valid method names come from
   `api/types/auth_webhook.go` — it is `WatchDocument`, not `WatchDocuments`, and an
   invalid name is rejected when the project is updated rather than ignored.
3. **A rotated token recovers, and the SDK does the work.** After the webhook started
   refusing the old token, `authTokenInjector` was called again — **with our webhook's
   own `reason` string as its argument** — and the retried `PushPull` went through with
   the new token. A second client read the edit back, so it really landed.
4. **⚠️ Yorkie caches an auth decision for 10s** (`DefaultAuthWebhookCacheTTL`,
   `server/config.go`). The first attempt at (3) showed no refusal at all: the rotated
   token kept working because Yorkie never re-asked. This is the finding with
   consequences beyond this task — see **Cross-cutting**.

## Milestones

### 1. Mint a token from the session

- **What**: `GET /api/auth/yorkie-token` reads the session cookie and returns a
  short-lived token for Yorkie, plus a webhook that validates it.
- **Files**: `lib/auth/yorkie-token.ts` (+ test), `app/api/auth/yorkie-token/route.ts`,
  `app/api/internal/yorkie/auth/route.ts`.
- **Reuse**: `sessionRegistry.resolve()` already turns a session id into a member, and
  `readSessionCookie()` already reads the cookie server-side. This adds a second,
  narrower credential rather than a second identity.
- **Why a separate token at all**: the session is an httpOnly cookie, deliberately — a
  token in the address bar would be readable during screen sharing (UC-030). Client JS
  therefore cannot read it, and `authTokenInjector` needs something it *can* hold. The
  new token is scoped to Yorkie and short-lived, so what JS holds is worth less than the
  session it came from.
- **Not persisted**, for the same reason sessions are not: a bearer token on the host's
  disk outlives the reason it was issued.
- **Done**: a guest with a session gets a token; no session gets a 401; the webhook
  accepts that token and refuses anything else.

### 2. Point Yorkie at the webhook on startup

- **What**: the app configures the Yorkie project itself when it boots.
- **Files**: `lib/yorkie-admin.ts` (+ test), `instrumentation.ts`, `.env.sample`,
  `docker-compose.yml`.
- **Reuse**: `instrumentation.ts` already runs once at startup and already fails loudly
  on bad config (`assertWorkspaceConfigured`).
- **Why not a documented command**: the webhook URL is a *project* field, not a server
  flag — `cmd/yorkie/server.go` exposes only the cache size and TTL — so something has to
  call the Admin API after Yorkie is up. Leaving that to the host would turn
  `docker compose up` into two steps and make an unguarded Yorkie the default when the
  second is forgotten.
- **Done**: `docker compose up` leaves the project configured; the app refuses to start
  if it cannot configure it, rather than serving an open Yorkie.

### 3. Hand the token to the client

- **What**: every `yorkie.Client` this app creates carries an `authTokenInjector`.
- **Files**: `app/(workspace)/presence-provider.tsx`, `lib/yorkie-address.ts`.
- **Reuse**: the provider is already the one place a client is constructed — the
  connected-user-list task collapsed two into one precisely so this would be true.
- **Done**: presence still works; a browser with no session cannot attach even with the
  page's own address.

## Acceptance

- [x] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [x] A guest who joined sees the roster exactly as before. Checked in a browser with
      the gate on: the header read `1명 접속 중 · Host (나)`, and a second member
      attaching through the app made it `2명 접속 중 · Host (나) · bob` with no reload
      and no console error.
- [x] `new yorkie.Client({ rpcAddr }).activate()` from outside the app — no token — is
      refused, where before it succeeded. An invented token is refused too, both as
      `[unauthenticated]` at `ActivateClient`, before any document is touched.
- [x] Startup refuses to serve when Yorkie is unreachable. **This failed the first
      way it was written** — see the Review.
- [ ] A token from one workspace session stops working after the app container restarts,
      because the session did. Follows from both registries being process memory, and
      from `session-registry.ts`'s "sessions are pointedly not restored", but not
      exercised against a real restart.

**One criterion was withdrawn rather than ticked.** It read:

> Killing the app server mid-session does not lock the browser out permanently: it
> recovers once the server is back, rather than needing a reload.

That contradicts the design it was written against. Sessions live in memory and
`session-registry.ts:66` is explicit that "sessions are pointedly not restored: every
member comes back signed out" — restarting the container *is* the documented revoke
path (`api.md`). A browser that recovered by itself would mean the restart had revoked
nothing.

What actually happens after a restart is what happened before this branch: the session
is gone, so the page redirects to `/join` on its next navigation. Yorkie now failing
alongside it is the same fact reaching one more place, not a new failure mode.

## Cut

- **Per-document access.** Every workspace member may open every document; the SRS gives
  documents no ownership. The webhook checks membership, not documents.
- **Token rotation on a timer.** The token expires; nothing pre-emptively refreshes it.
  Measured above: the SDK asks for a new one when the webhook refuses, which is the path
  that has to work anyway.
- **Signing the webhook request.** Yorkie sends the token and the method; anyone on the
  LAN could call `/internal/yorkie/auth` themselves, and all they would learn is whether
  a token they already hold is valid. Worth revisiting with the same HMAC guard
  wafflebase uses if the endpoint ever answers something richer.

## Cross-cutting

- **Requirements**: NFR-SEC-002 (block unauthenticated access to the workspace),
  NFR-SEC-005 (block unauthorized access to workspace-internal data). Both are listed
  under `ROADMAP.md` Phase 5; this pulls them forward because Phase 1's editor is what
  makes them real.
- **The 10-second auth cache changes what a kick means.** UC-011 removes a guest and
  closes their socket, but Yorkie will keep honouring their last decision for up to
  `authWebhookCacheTTL`. A kicked guest can therefore still write to a document for a few
  seconds. Not this task's to fix — it is the Members screen's — but it is not visible
  from that screen's code, so it is written here, along with the handle:

  ```yaml
  command: ["server", "--auth-webhook-cache-auth-ttl", "1s", …]
  ```

  Unlike the webhook URL this *is* a server flag, so it belongs in
  `docker-compose.yml` rather than an Admin API call. Left at its default here and
  tracked as [#48](https://github.com/CBNU-TeamH/RMF-Block/issues/48): the number
  follows from what UC-011 requires of a kick, which this task does not own. Worth
  knowing that leaving it unset is not neutral — 10s is Yorkie's default for a
  multi-tenant service whose webhook crosses a network, and none of that describes a
  local call in an eight-person workspace.
- **Docs that go stale**: `api.md` §2's "**Not implemented.**" paragraph, and its note
  that the SDK's refresh path "needs verifying" — it has been. Both are edited here,
  which is a design doc rather than an agreed one (`AGENTS.md` §5).

## Review

Filled in at the end.
