# RMF-Block

A LAN-based real-time document collaboration system. A **host** runs the system as a Docker container; users on the **same subnet** open a URL in their browser and collaborate in real time.

CBNU Team H capstone project.

> **This README is a working document for development** — it maps the repository so teammates and AI agents can find things. The user-facing README comes once the product is done.

## Start here

Read [`AGENTS.md`](AGENTS.md) first. It is the single entry point: workflow, coding principles, doc routing, and team conventions.

**Stack:** TypeScript · Next.js (App Router) · [Yorkie](https://yorkie.dev) (CRDT) for real-time sync · local Git for persistence and history. Single package, single process, pnpm. Decided in [`docs/SRS-ko.md`](docs/SRS-ko.md) §2.3.2.

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
| [`server/`](server/) | Node processes that run alongside the app (currently the Yorkie → Git watcher). |
| [`public/`](public/) | Static assets served as-is. |
| [`instrumentation.ts`](instrumentation.ts) | Server startup hook — prints the host link and the guest join address. |
| [`Dockerfile`](Dockerfile) · [`docker-compose.yml`](docker-compose.yml) | The image the host runs, plus the self-hosted Yorkie server. |
| [`skills/`](skills/) | Skills for Claude Code. Empty for now — add them as we find workflows worth packaging. |

Root config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`) are the real, live settings — not templates.

## Running it

**As the host would** — one command, the way the product ships:

```bash
docker compose up --build
```

Startup prints two lines. The `Host:` link is a one-time link that proves you are the host — opening
it gives you a cookie and drops the secret from the address bar. The `Guest:` line is what anyone
else on the same subnet types into their browser.

```
rmf-app  |   Host:  http://localhost:3000/api/auth/host?secret=…
rmf-app  |   Guest: http://192.168.0.14:3000
```

A container can only see Docker's own network, so it usually cannot work out the LAN address by
itself. When it says so, run `hostname -I` (Linux/macOS) or `ipconfig` (Windows) on the host machine
and restart with that address: `HOST_LAN_IP=192.168.0.14 docker compose up`, or put the same line in
a `.env` file next to `docker-compose.yml`.

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

Yorkie runs on its in-memory store, so restarting the container wipes every document. Git is the
durable layer — see [`docs/SRS-ko.md`](docs/SRS-ko.md) §2.3.2.

## Ground rules

- **This repo is canonical.** Discussion may happen elsewhere (e.g., Notion), but the source of truth is here; sync is one-way _into_ this repo.
- **Docs live with the code.** A change and the doc describing it belong in the same commit.
- **Commit prefixes and doc language:** see [`AGENTS.md`](AGENTS.md) §5.
- **Line endings:** enforced by `.gitattributes` (`eol=lf`). On first clone run the same command on Windows / macOS / Linux:

```bash
git config --global core.autocrlf input
```
