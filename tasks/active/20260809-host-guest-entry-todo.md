# Host / Guest entry

**Created**: 2026-08-09
**Issue**: —
**Design**: [`docs/design/api.md`](../../docs/design/api.md) — Authentication model and the
`/api/auth/host` entry in the endpoint catalog. No separate module design doc: this task implements a
decision already recorded there rather than making a new one.

## Goal

The thinnest end-to-end slice of UC-010 / UC-020: the host runs our Docker image, the server proves
who the host is, and any browser on the same subnet reaches the app by typing `IP:port`. Host sees
`hello host!`, guest sees `hello guest!` — that difference is the whole acceptance surface.

No Yorkie, no realtime, no workspace, no login. Guest login (nickname + workspace password,
FR-020-01~05) is the next task.

## Milestones

### 1. The image the host runs ✅

- **What**: `docker compose up --build` starts the app, reachable from other machines on the LAN.
- **Files**: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `next.config.ts`, `package.json`.
- **Reuse**: the existing `docker-compose.yml` (Yorkie service untouched) and the pinned pnpm
  patches, which have to be applied inside the image too.
- **Done**: `docker compose up --build` serves `http://localhost:3000`, and the published port is
  reachable from a second device.

### 2. Host identity from container stdout ✅

- **What**: the server mints a bootstrap secret at startup and prints a one-time link; opening it
  trades the secret for a cookie.
- **Files**: `instrumentation.ts`, `lib/host-secret.ts`, `app/api/auth/host/route.ts`.
- **Reuse**: nothing existed — this is the first server-side code outside the spike watcher.
- **Done**: the printed link shows `hello host!`; anything else shows `hello guest!`.

### 3. The join address the host reads out ✅

- **What**: print the LAN address guests type in, and say what to do when only Docker's own network
  is visible (FR-010-03, HIR001).
- **Files**: `lib/lan-address.ts`, `lib/lan-address.test.mts`, `docker-compose.yml`.
- **Reuse**: `node:os` `networkInterfaces()` — no dependency.
- **Done**: startup prints a usable `Guest:` line, or names the Docker address it saw and how to
  override it with `HOST_LAN_IP`.

### 4. The two pages ✅

- **What**: `/` renders `hello host!` or `hello guest!` from the cookie.
- **Files**: `app/page.tsx` (replaces the create-next-app template), `app/layout.tsx` (title).
- **Reuse**: existing Tailwind v4 setup and the layout's flex shell.
- **Done**: see Acceptance.

## Acceptance

- [x] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [x] `docker compose up --build` prints a `Host:` link and a `Guest:` line.
- [x] Opening the `Host:` link lands on `/` showing **hello host!**, with no secret left in the URL.
- [x] `http://localhost:3000/` with no cookie shows **hello guest!**.
- [x] `?secret=wrong` and a missing `?secret=` both land on **hello guest!**, no cookie set.
- [x] `docker compose restart app` invalidates the previous host cookie — the old tab reloads to
      **hello guest!** and the newly printed link works. (Revoke path per `api.md`.)
- [x] `HOST_LAN_IP=192.168.0.14 docker compose up` prints that address and drops the hint.
- [ ] A second device on the same Wi-Fi opens the `Guest:` URL and sees **hello guest!**.
      *Verified only from the host machine so far — needs a real two-device run.*
- [x] `/spike/prosemirror` still works; the spike did not regress.

## Cross-cutting

- **Requirements**: FR-010-03 (join address shown to the host), FR-011-07 (host-only auth),
  HIR001 / SOIR002 (Docker run + address display), UC-020 steps 1–2 (guest reaches the app by
  address). NFR-SEC-002 is only partly served — there is no session token yet.
- **Divergence from `docs/design/api.md`**: the catalog says `POST /api/auth/host` returning a host
  session token. This ships `GET /api/auth/host?secret=` setting a cookie, because a magic link in
  stdout is the whole point and there are no session tokens to return yet. It becomes the catalogued
  POST when tokens land; `api.md` does not need editing before then.
- **New convention, not yet written down**: tests are `*.test.mts` run by `node --test`
  (`pnpm test`) — stdlib, no framework. `docs/` still has no test-strategy doc; this is the first
  test in the repo and should inform it.
- **Docs**: `README.md` "Running it" now leads with the Docker path.
- **`AGENTS.md` still has no run/verify commands section** — flagged by the Yorkie spike too.

## Review

Shipped milestones 1–4. Cut as planned: workspace name/password screen, guest nickname login,
session/refresh tokens, `/health`, WebSocket, Yorkie wiring, restore-on-restart.

One acceptance box is still open — the two-device LAN check — because it cannot be done from this
machine alone. Everything else was verified against the running container, not just `next dev`.
