# Admin page — setup, password change, guest kick; webhook cache TTL

**Created**: 2026-10-07
**Issue**: #106 (UC-010/UC-011, WBS 18.1) + #48 (WBS 14.7), milestone v0.0.1
**Design**: [`docs/design/api.md`](../../docs/design/api.md) (Authentication model, endpoint table, Yorkie auth webhook) and [`docs/design/app-shell.md`](../../docs/design/app-shell.md); both are updated in this PR.

## Plan

Decisions settled with the user (2026-10-07):

1. **Where the password lives** — `.data/workspace.json` `{ name, salt, passwordHash }`, scrypt-hashed (`node:crypto`), compared with `timingSafeEqual`. Write-then-rename, the same shape as `member-repository.ts` (a shared `.data/` helper is #114's job, not this one).
2. **The env variables** — a **dev/CI seed only**: when `workspace.json` does not exist, startup writes a valid `WORKSPACE_PASSWORD` (and `WORKSPACE_NAME`) into it (`seedWorkspaceFromEnv()`), so CI's smoke test and E2E keep working unchanged and every reader sees one source. People running the image never touch `.env`: `.env.sample`, README and compose stop asking for it, and an empty env means the host sets it on the setup screen.
3. **Boot** — the server always starts. `assertWorkspaceConfigured()` goes; while the workspace is not open, startup prints "host user의 workspace setting이 완료되지 않았습니다." under the Host link (the user's wording).
   **Persistence**: the settings live in `.data/workspace.json`, on the `app-data` named volume in the container — they survive restarts and `up --build`, and only `docker compose down -v` removes them. Once the file exists the env seed is never read again. The host secret is still minted per restart; the settings are not tied to it.
4. **UI** — `/admin`, outside the `(workspace)` shell like `/join`, host only. Not open → setup form (name + password). Open → password change + the connected guests with 퇴장 behind a confirm dialog (`ui.tsx` dialog kit). The top nav shows the host — and only the host — a link to the admin page. A host on `/` before setup is sent to `/admin`; `/join` says the workspace is not open yet.
5. **Kick** — `sessionRegistry.kick(memberId)` drops the live session (the member record stays: UC-011 is not a ban), `wsHub.revoke(sessionId, "kicked")` tells the socket why, and the kicked browser lands on `/join?reason=kicked` showing "워크스페이스에서 퇴장되었습니다". Its presence leaves with its Yorkie client.
6. **Webhook cache TTL (#48)** — `--auth-webhook-cache-auth-ttl 1s` on the Yorkie service. It is the kick's latency in Yorkie: refusals (401) are never cached, allows are cached for the TTL. 1s absorbs a typing burst's PushPulls and still reads as instant; the webhook is a call inside the compose network, so the cache saves almost nothing.
7. **Not in scope** — renaming the workspace after setup (SRS asks for a name at setup only), pruning stored members, IP bans (#106 "Out of scope").

## Milestones

### 1. Workspace settings on disk

- **What**: `lib/workspace-config.ts` gains `isWorkspaceOpen`, `openWorkspace`, `changeWorkspacePassword`, `seedWorkspaceFromEnv`; every reader reads only `workspace.json` — the env seed is written into it once at startup, never read after. A damaged file counts as not set up.
- **Files**: `lib/workspace-config.ts`, `lib/workspace-config.test.mts`, `instrumentation.ts`.
- **Reuse**: write-then-rename from `lib/auth/member-repository.ts`; `MIN_PASSWORD_LENGTH`.
- **Done**: tests for seed, hash compare, open/change, too short, already open, change before setup, damaged file; the server boots with no password.

### 2. Host-only routes

- **What**: `POST /api/workspace` (setup, 409 when open), `PATCH /api/workspace/password`, `DELETE /api/workspace/members/[id]`; `POST /api/workspace/join` answers 503 while not open. Non-host → 401 (FR-011-07).
- **Files**: `app/api/workspace/route.ts`, `app/api/workspace/password/route.ts`, `app/api/workspace/members/[id]/route.ts`, `app/api/workspace/join/route.ts`, `lib/auth/session-registry.ts` (`kick`, `liveMembers`), `server/ws-hub.mts` (`revoke` reason).
- **Reuse**: `isHostSecret`; `join()`'s revoke bookkeeping; `wsHub.revoke`.
- **Done**: route tests per endpoint (host / non-host / bad input); registry tests for `kick`/`liveMembers`.

### 3. Admin page and the kicked guest's screen

- **What**: `/admin` (setup or manage), the host-only 관리자 link in the top nav, `/` → `/admin` for a host before setup, `/join` closed state and kicked message, `SessionWatch` passing the reason on.
- **Files**: `app/admin/page.tsx`, `app/admin/admin-forms.tsx`, `app/(workspace)/layout.tsx`, `app/join/page.tsx`, `app/session-watch.tsx`.
- **Reuse**: `join-form.tsx`'s fetch/error pattern; `DIALOG`, `CANCEL`, `confirmClass`, `inputClass`, `FIELD_LABEL` from `app/(workspace)/ui.tsx`.
- **Done**: component tests for the confirm-before-kick flow and the kicked message.

### 4. Yorkie TTL and docs

- **What**: compose flag with its reason; README / `.env.sample` say the password is set in the app; `api.md` and `app-shell.md` describe the new state.
- **Files**: `docker-compose.yml`, `.env.sample`, `README.md`, `docs/design/api.md`, `docs/design/app-shell.md`.
- **Done**: `pnpm verify:docs` clean.

## Acceptance

- [ ] FR-010-01~05, FR-011-01~07 each covered by a unit, route or component test
- [ ] By hand, against the container with an empty `WORKSPACE_PASSWORD`: setup → join → password change keeps the connected guest, a new join needs the new password → kick asks first, the guest sees the message and leaves everyone's roster, their edits stop within a second → a restart keeps the settings
- [ ] CI smoke test and E2E still pass on the env seed
- [ ] `pnpm verify:docs`, pre-push hook (test + build) green
- [ ] `/simplify` and `/code-review low` run in this session, findings applied

## Cross-cutting

FR-010-01~06, FR-011-01~07, NFR-REL-002. Touches the auth model (`api.md` "restart is the revoke path" gains the per-guest kick). `.data/workspace.json` is new app state on the `app-data` volume; #114 later consolidates the `.data/` helpers.

## Review

_Filled in at the end._
