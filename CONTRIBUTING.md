# Contributing to RMF-Block

[`AGENTS.md`](AGENTS.md) is the rulebook — workflow, coding principles, conventions — and what a
pull request is reviewed against. This file is the how-to: a working setup, the checks, and the
path to a PR. Where the two touch, this file links to `AGENTS.md` rather than repeating it.

## TL;DR

1. Branch from `main` as `<type>/<slug>` (`feat/`, `fix/`, `docs/` …).
2. Register the work as a todo + lessons pair in `tasks/active/` and plan it there.
3. Build it; `pnpm verify:fast` and `pnpm verify:docs` clean.
4. Run the review passes, then open a PR from the template.

The order and its reasons: `AGENTS.md` §2 (workflow) and §6 (branches and pull requests).

## Development setup

Node.js 24 ([`.nvmrc`](.nvmrc)), pnpm 10, and Docker with Compose 2.20 or newer.

```bash
pnpm install
docker compose up -d yorkie   # Yorkie on :8080 — realtime sync needs it
pnpm dev                      # http://localhost:3000, the same Host/Guest lines on stdout
```

Once per machine, so line endings match `.gitattributes` (`eol=lf`) on every OS:

```bash
git config --global core.autocrlf input
```

Three traps, all found the hard way:

- **Run `pnpm build` after `pnpm dev`, not before.** A production build leaves a `.next` the dev
  server cannot use, and it fails with `Could not parse module '[project]/instrumentation.ts', file
  not found` for a file that plainly exists. `rm -rf .next` fixes it.
- **Docker Compose must be 2.20 or newer.** `docker-compose.yml` uses `attach: false` on the mongo
  service; older Compose (2.13 was measured) refuses the whole file with `services.mongo Additional
  property attach is not allowed`.
- **`pnpm dev` is reachable from this machine only — test other devices against the container.**
  Next's dev server refuses `/_next/*` to any host but `localhost`, so a phone at
  `http://<LAN-IP>:3000` gets the server-rendered HTML and no client JavaScript. The page draws,
  React never hydrates, and the join form falls back to a plain `GET` that never logs in — which
  reads exactly like a wrong password. Use `pnpm docker:up` (or `pnpm build && pnpm start`).

Changes to server startup, auth or networking are verified against the container, not `pnpm dev`
(`AGENTS.md` §2, "Run and verify").

## Where things are

| Path | Contents |
| :--- | :--- |
| `app/` | Next.js App Router — pages, layouts, route handlers |
| `lib/` | Code the app and the server both import, one directory per module |
| `server/` | The custom server entry point and the WebSocket hub |
| `e2e/` | Playwright tests against the running stack |
| `docs/` | Requirements, module design, ADRs, UI wireframes |
| `tasks/` | Work in progress (`active/`) and finished work (`archive/`) — [`tasks/README.md`](tasks/README.md) |
| `scripts/` | Doc checks and task helpers, behind the `package.json` scripts; `detect-host-ip.sh` is what `pnpm docker:up` runs first |
| `instrumentation.ts` | Server startup — prints the Host and Guest lines |
| `Dockerfile` · `docker-compose.yml` | The image the host runs, and the Yorkie and MongoDB containers beside it |
| `.claude/skills/` | Review-plugin pointers and the repo's own skills — [`.claude/skills/README.md`](.claude/skills/README.md) |

Which design doc owns which of these: each `docs/design/*.md` names its files on its **Owns**
line.

## Checks

| Command | What it runs |
| :--- | :--- |
| `pnpm verify:fast` | `pnpm lint` and `pnpm test` (Vitest) |
| `pnpm verify:docs` | Doc checks — ownership, task index, dead links and anchors, SRS sync and IDs, declared facts, the generated endpoint table, the skills mirror |
| `pnpm comments` | The comment budget ([`docs/conventions.md`](docs/conventions.md)) |
| `pnpm e2e` | Playwright against a running stack — `pnpm docker:up` first, with `E2E_WORKSPACE_PASSWORD` set to `.env`'s `WORKSPACE_PASSWORD` |
| `pnpm build` | The production build |

The git hooks in `.githooks/` run the cheap ones for you: pre-commit lints the staged `.ts`/`.tsx`
files and checks their comment budget; pre-push runs the comment budget, the test suite and the
build. What CI runs and which checks block a merge: `AGENTS.md` §6. How the layers of tests divide
the work: [`docs/testing.md`](docs/testing.md).

## Pull requests

- **Commit prefixes, doc language, agreed documents**: `AGENTS.md` §5.
- **One branch and one PR per task**, squash-merged, with the description started from
  [`.github/pull_request_template.md`](.github/pull_request_template.md): `AGENTS.md` §6.
- **Review passes** (`/simplify`, `/code-review low`) and why they run the way they do:
  [`.claude/skills/README.md`](.claude/skills/README.md).
- **When the work is merged**, archive its task with `pnpm tasks:archive <slug>` in its own PR
  ([`.github/PULL_REQUEST_TEMPLATE/archive.md`](.github/PULL_REQUEST_TEMPLATE/archive.md)).

## Ground rules

- **This repository is the source of truth.** Discussion may happen elsewhere (Notion, chat), but
  decisions land here; sync is one way, into the repo.
- **Docs live with the code.** A change and the doc that describes it go in the same commit.
