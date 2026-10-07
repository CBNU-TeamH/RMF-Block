# Contributing to RMF-Block

[`AGENTS.md`](AGENTS.md) is the rulebook a pull request is reviewed against; this file is the
how-to.

## TL;DR

1. Branch from `CBNU-TeamH/RMF-Block`'s `main` — `upstream/main` on a fork, see below — as
   `<type>/<slug>`; one branch and one squash-merged PR per task (`AGENTS.md` §6).
2. Register the work as a todo + lessons pair in `tasks/active/` and plan it there (`AGENTS.md` §2).
3. [Select tests for the change](docs/testing.md#select-tests-for-each-change), build it, then
   revisit coverage for the final behavior, including E2E and container smoke. Include required
   new/updated tests in this PR; run the relevant checks plus `pnpm verify:fast` and `pnpm verify:docs`.
4. Run the review passes ([`.claude/skills/README.md`](.claude/skills/README.md)), then open a PR
   from [`.github/pull_request_template.md`](.github/pull_request_template.md).

## Development setup

Node.js ([`.nvmrc`](.nvmrc)), pnpm (pinned in `package.json` — `corepack enable` provides it), and
Docker Compose 2.20 or newer (the trap below says why).

```bash
pnpm install
cp .env.sample .env
```

`WORKSPACE_PASSWORD` is optional: left empty, the server starts unopened and the Host link leads to
the setup screen; set (at least four characters), it seeds a workspace that has never been set up —
handy for development and E2E, ignored once the setup screen has saved its own. Configure both
Yorkie addresses. For the app running natively beside Yorkie on Docker Desktop:

```dotenv
YORKIE_ADMIN_ADDR=http://localhost:8080
YORKIE_AUTH_WEBHOOK_URL=http://host.docker.internal:3000/api/internal/yorkie/auth
```

The sample's empty Yorkie values override the startup defaults; leaving them blank makes
webhook registration fail. On Linux Docker Engine, use a host address reachable from Yorkie's
container for `YORKIE_AUTH_WEBHOOK_URL`, or add `host.docker.internal:host-gateway` to the Yorkie
service's `extra_hosts` before using the Docker Desktop example. The full container stack sets
both addresses itself in `docker-compose.yml`; these values are for native development.

```bash
docker compose up -d yorkie   # Yorkie on :8080 — realtime sync needs it
pnpm dev                      # http://localhost:3000; prints the Host and Guest lines
```

`pnpm dev` is reachable from other devices on the LAN too. On WSL, LAN access requires mirrored
networking or explicit port forwarding (see [README](README.md#if-a-guest-cannot-connect)).
`pnpm start` serves a production build, but without the Yorkie container behind it — the host
runs the image. Changes to server
startup, auth or networking are verified against the container (`AGENTS.md` §2, "Run and verify").

Once per machine, so line endings match `.gitattributes` (`eol=lf`) on every OS:

```bash
git config --global core.autocrlf input
```

**Older Docker Compose refuses the file.** `docker-compose.yml` uses `attach: false` on the mongo
service; Compose before 2.20 (2.13 was measured) rejects the whole file with `services.mongo
Additional property attach is not allowed`.

## Where things are

| Path | Contents |
| :--- | :--- |
| `app/` | Next.js App Router — pages, layouts, route handlers |
| `lib/` | Code the app and the server both import — a directory per module, plus a few single-file helpers |
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
| `pnpm verify:docs` | The doc checks — what they cover: [`.claude/skills/README.md`](.claude/skills/README.md), "Run the free checks first" |
| `pnpm comments` | The comment budget ([`docs/conventions.md`](docs/conventions.md)) |
| `pnpm e2e:isolated` | Disposable Docker stack and functional E2E on loopback ports 3100/8180 |
| `pnpm e2e` | Playwright against a running stack — how to run it: [`docs/testing.md`](docs/testing.md), "E2E" |
| `pnpm build` | The production build |

The git hooks in `.githooks/` run some of these for you — each hook's header says which — and
pre-push includes the test suite and the build, so a push takes a minute or two. What CI runs and
which checks block a merge: `AGENTS.md` §6. How the layers of tests divide the work:
[`docs/testing.md`](docs/testing.md).

## Pull requests

- **Commit prefixes, doc language, ground rules**: `AGENTS.md` §5.
- **Branch from `CBNU-TeamH/RMF-Block`'s `main`.** Cloned directly, that is `origin/main`. On a
  fork, never your fork's `main`: after a squash merge it lags until someone syncs it, and a branch
  cut from it silently misses the last merge. Add the original once
  (`git remote add upstream https://github.com/CBNU-TeamH/RMF-Block.git`), then
  `git fetch upstream && git checkout -b <type>/<slug> upstream/main`.
- **When the work is done**, archive its task with `pnpm tasks:archive <slug>` (`AGENTS.md` §2,
  step 5); an archive-only PR starts from
  [`.github/PULL_REQUEST_TEMPLATE/archive.md`](.github/PULL_REQUEST_TEMPLATE/archive.md). It is
  **`docs:`** work — branch `docs/archive-<slug>`, commit and PR titled `docs: archive …` — since it
  only moves task documents and regenerates the two task indexes; no application code or behaviour
  changes. Earlier archives used `chore:`;
  they stay as they are.
