# Chat service — Version A, text slice

**Created**: 2026-08-12
**Issue**: —
**Design**: [`docs/design/chat.md`](../../docs/design/chat.md)

## Milestones

### 1. Chat API contract

- **What**: `app/api/chat/route.ts` defines the outer call shape (`GET` history, `POST` send) and
  the `ChatService`/`ChatRepository`/`ChatBroadcaster` interfaces it depends on.
- **Files**: `lib/chat/types.ts`, `app/api/chat/route.ts`.
- **Reuse**: `app/api/auth/host/route.ts`'s Route Handler conventions (`NextResponse`, error shape).
- **Done**: types compile in isolation; route.ts expresses the full contract even though
  `chat-service.ts` doesn't exist yet (outside-in — reviewed before the inner layers are built).

### 2. ChatService

- **What**: `send()`/`list()`, validation, delegates to injected repository + broadcaster.
- **Files**: `lib/chat/chat-service.ts`.
- **Reuse**: `ChatValidationError` from milestone 1.
- **Done**: `route.ts` now type-checks against a real `ChatService`.

### 3. JSON-file repository

- **What**: `ChatRepository` implementation backed by `.data/chat/messages.json`.
- **Files**: `lib/chat/chat-repository.ts`.
- **Reuse**: `.data/` convention already established by `server/watcher.mts`.
- **Done**: messages appended survive a process restart.

### 4. WS hub

- **What**: generic connection registry implementing `ChatBroadcaster`; not chat-specific.
- **Files**: `server/ws-hub.mts`.
- **Reuse**: `globalThis`-cache pattern from `lib/host-secret.ts` (HMR-safe singleton).
- **Done**: `broadcast()` reaches every registered connection.

### 5. Custom server

- **What**: replaces `next start`/`next dev` as the process entry point — HTTP passthrough to
  Next's handler, WS upgrade routed to `ws-hub.mts` by path, everything else left for Next's own
  HMR upgrade handling.
- **Files**: `server/index.mts`.
- **Reuse**: none — first server-side HTTP bootstrap in this repo (`instrumentation.ts` is a hook
  into Next's own server, not a replacement for it).
- **Done**: `node server/index.mts` serves normal HTTP and accepts a WS connection on the same port.

### 6. Boot/build wiring

- **What**: point the project at the custom server; drop `output: "standalone"` since it can't
  coexist with one (see `docs/design/chat.md`).
- **Files**: `next.config.ts`, `package.json` (`dev`/`start` scripts, `ws`/`@types/ws` deps),
  `Dockerfile` (runtime stage: full prod `node_modules` instead of the standalone trace).
- **Reuse**: n/a — mechanical swap, no existing route/page logic touched.
- **Done**: `docker compose up --build` serves chat over REST + WS from one container.

## Acceptance

- [x] `pnpm lint`, `pnpm test`, and `pnpm build` pass.
- [x] `POST /api/chat` with `{ sender, text }` persists the message and returns it (201).
- [x] Missing/empty `text` returns 400 with a `ChatValidationError` message, not a 500.
- [x] A second connected client receives the message over WebSocket within ~1s (NFR-PER-004),
      without polling `GET /api/chat` — measured ~840–990ms end-to-end against the real container.
- [x] `GET /api/chat` returns full history — used to verify a reconnecting client can backfill.
- [x] Restarting the container preserves `.data/chat/messages.json` and its contents.
- [x] `app/page.tsx`, `lib/host-secret.ts`, `lib/lan-address.ts`, `server/watcher.mts` are
      byte-identical to `main` — confirms the isolation goal held.

## Cross-cutting

- **Requirements**: FR-060-01/04/05/07, NFR-PER-004 (1s delivery), NFR-MAI-001 (independent module
  structure — motivates `ws-hub.mts` being generic, not chat-only).
- **Deferred, not designed here**: FR-060-02/03/06 (file/URL/block-link attachments), UC-061 (chat
  file management), real user identity for `sender` (waits on UC-020 guest login), Version B
  (Yorkie-native chat) and whether it can share `ChatService`'s interface — `api.md`'s open question.
- **Docs**: `docs/design/chat.md` (new). No change to `docs/SRS-ko.md` or `docs/design/api.md` —
  this task implements what they already specify.

## Review

Shipped milestones 1–6, verified end-to-end against the real `docker compose up --build` container
(not just `pnpm dev`) — REST send/history, WS broadcast, restart-persistence, validation, and the
isolation goal all confirmed. Four bugs surfaced only under real verification, all fixed:

1. `chat-service.ts` importing `@/server/ws-hub` without the `.mts` extension — Turbopack couldn't
   resolve it (fixed: explicit `.mts` extension on that one import).
2. `app.getUpgradeHandler()` called before `app.prepare()` — throws, since (unlike
   `getRequestHandler()`) it isn't lazy in `NextCustomServer`. Fixed by moving it after `prepare()`.
3. `pnpm-lock.yaml` not updated for the new `ws`/`@types/ws` deps — `--frozen-lockfile` failed in
   the Docker build. Fixed by running `pnpm install` locally first.
4. `/app` owned by root in the image, `USER node` can't create `.data/chat/` — every `POST` 500'd
   silently (route.ts's catch didn't log). Fixed with a `chown` step in the Dockerfile before
   `USER node`, and added `console.error` in the catch block so this class of bug surfaces in
   container logs next time instead of just a generic 500.

Nothing cut from the planned scope. FR-060-02/03/06, UC-061, and Version B remain deferred as
recorded in Cross-cutting above.
