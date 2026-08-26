# RMF-Block

A LAN-based real-time document collaboration system. A **host** runs the system as a Docker container; users on the **same subnet** open a URL in their browser and collaborate in real time.

CBNU Team H capstone project.

> **This README is a working document for development** — it maps the repository so teammates and AI agents can find things. The user-facing README comes once the product is done.

## Start here

Read [`AGENTS.md`](AGENTS.md) first. It is the single entry point: workflow, coding principles, doc routing, and team conventions.

**Stack:** TypeScript · Next.js (App Router) · [Yorkie](https://yorkie.dev) (CRDT) for real-time sync, document persistence, and version history, backed by MongoDB · host-held JSON files for the app's own state. Single package, single app process, pnpm. Decided in [`docs/SRS-ko.md`](docs/SRS-ko.md) §2.3.2 and [`docs/adr/002-persistence-on-yorkie-mongo.md`](docs/adr/002-persistence-on-yorkie-mongo.md).

## Structure

| Path | Contents |
| :--- | :--- |
| [`AGENTS.md`](AGENTS.md) | Entry point — read first. Workflow, coding principles, doc routing. |
| [`CLAUDE.md`](CLAUDE.md) | Imports `AGENTS.md` for Claude Code. |
| [`ROADMAP.md`](ROADMAP.md) | Overall plan and milestones. |
| [`docs/`](docs/) | Deliverable docs: requirements ([`SRS-ko.md`](docs/SRS-ko.md)), module design, UI wireframes, architecture decisions (ADRs). |
| [`tasks/`](tasks/) | Work in progress (`active/`) and finished work (`archive/YYYY/MM/`). See [`tasks/README.md`](tasks/README.md). |
| [`scripts/`](scripts/) | Repo bookkeeping. Currently just the task index and archive helpers (`pnpm tasks:index`, `pnpm tasks:archive`). |
| [`app/`](app/) | Next.js App Router — pages, layouts, route handlers. |
| [`lib/`](lib/) | Shared code that both the app and server-side processes import. |
| [`server/`](server/) | The custom server entry point and the WebSocket hub. |
| [`public/`](public/) | Static assets served as-is. |
| [`instrumentation.ts`](instrumentation.ts) | Server startup hook — prints the host link and the guest join address. |
| [`Dockerfile`](Dockerfile) · [`docker-compose.yml`](docker-compose.yml) | The image the host runs, plus the self-hosted Yorkie server and its MongoDB store. |
| [`skills/`](skills/) | Skills for Claude Code. Empty for now — add them as we find workflows worth packaging. |

Root config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`) are the real, live settings — not templates.

## Running it

**As the host would** — one command, the way the product ships:

```bash
pnpm docker:up
```

This runs [`scripts/detect-host-ip.sh`](scripts/detect-host-ip.sh), which finds the host's LAN IP and
writes it to `.env` as `HOST_LAN_IP`, then `docker compose up --build`. Every later run reuses the same
`.env`, no retyping addresses. (`pnpm start` runs the server process directly, without the Yorkie
container behind it — the host wants the image.) Detection asks the routing table which interface
carries the default route and takes that one's address, rather than guessing from the address itself —
so it still picks the right adapter on a campus LAN that hands out `172.x` addresses, where guessing
would mistake the real address for a Docker or WSL virtual one.

Linux and macOS only. On Windows that means **run it from WSL**, which is where Docker Desktop's backend
lives anyway; from Git Bash the script says so and stops rather than guessing. Under WSL it also checks
for mirrored networking (see below) — without it WSL sits on its own NAT and the detected address is
WSL's rather than your LAN's, so the check warns and continues rather than blocking.

Prefer to do it by hand, or on a host with no default route to read? `docker compose up --build` still
works — copy [`.env.sample`](.env.sample) to `.env` and fill in `HOST_LAN_IP` yourself (`ip -4 addr` on
Linux, `ipconfig getifaddr en0` on macOS, `ipconfig` on Windows), or pass it inline:
`HOST_LAN_IP=192.168.0.14 docker compose up`.

Startup prints two lines. The `Host:` link proves you are the host — opening it gives you a cookie
and drops the secret from the address bar. The secret stays valid until the container restarts, so
treat the line as a credential, not a used-up ticket. The `Guest:` line is what anyone else on the
same subnet types into their browser.

```
rmf-app  |   Host:  http://localhost:3000/api/auth/host?secret=…
rmf-app  |   Guest: http://192.168.0.14:3000
```

Guests reach the `Guest:` link only if they're on the **same subnet** *and* that subnet doesn't apply
**client/AP isolation** (common on campus and guest Wi-Fi — it blocks devices from reaching each other
even on the same network). If a guest can't connect, that's the first thing to rule out, not the IP —
and it's not something any script here can detect or fix, since it's a router/AP setting outside the
host machine.

**Windows hosts — mirrored networking:** if `HOST_LAN_IP` prints correctly but guests still can't reach
it, Docker Desktop's WSL2 backend is likely only forwarding the port to `127.0.0.1`, not the real network
adapter. `pnpm docker:up` detects this and prints the fix; by hand, add `networkingMode=mirrored` under
`[wsl2]` in `%UserProfile%\.wslconfig`, then run `wsl --shutdown` and restart Docker Desktop. Requires
Windows 11 22H2+; on older Windows, forward the port to the host's LAN IP yourself (e.g.
`netsh interface portproxy`). `wsl --shutdown` closes every WSL session, not just this project's, so
finish other WSL work first.

Restarting the container mints a new secret and invalidates every host session — that is the revoke
path ([`docs/design/api.md`](docs/design/api.md)), not an accident.

**While developing:**

```bash
pnpm install
docker compose up -d yorkie   # Yorkie on :8080 — realtime sync needs it
pnpm dev                      # http://localhost:3000, same two lines on stdout
pnpm lint
pnpm test                     # node:test, no framework
pnpm build
```

Two traps worth knowing before you hit them, both found the hard way:

- **Run `pnpm build` last, not before `pnpm dev`.** A production build leaves a `.next` the dev
  server cannot use, and it fails with `Could not parse module '[project]/instrumentation.ts', file
  not found` for a file that plainly exists. `rm -rf .next` fixes it. The block above is in a safe
  order; reversing the last two lines is not.
- **Docker Compose must be 2.20 or newer.** `docker-compose.yml` uses `attach: false` on the mongo
  service to keep the host's terminal readable. Older Compose (2.13 was measured) refuses the whole
  file with `services.mongo Additional property attach is not allowed`.

Documents live in Yorkie, which persists them to MongoDB — see [`docs/SRS-ko.md`](docs/SRS-ko.md) §2.3.2.
The app's own state is written as JSON under `.data/` — chat today, with workspace metadata and auth
records planned but still in-memory only.

It survives `down` and `up --build` on the `app-data` volume, the same way documents survive on
`mongo-data`. Both are named volumes, so `docker compose down -v` still wipes them — that is the
"start the session over" button, and it is the only thing that does.

## Ground rules

- **This repo is canonical.** Discussion may happen elsewhere (e.g., Notion), but the source of truth is here; sync is one-way _into_ this repo.
- **Docs live with the code.** A change and the doc describing it belong in the same commit.
- **Commit prefixes and doc language:** see [`AGENTS.md`](AGENTS.md) §5.
- **Line endings:** enforced by `.gitattributes` (`eol=lf`). On first clone run the same command on Windows / macOS / Linux:

```bash
git config --global core.autocrlf input
```
