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
| [`public/`](public/) | Static assets served as-is. |
| [`skills/`](skills/) | Skills for Claude Code. Empty for now — add them as we find workflows worth packaging. |

Root config files (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`) are the real, live settings — not templates.

## Running it

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build
pnpm lint
```

## Ground rules

- **This repo is canonical.** Discussion may happen elsewhere (e.g., Notion), but the source of truth is here; sync is one-way _into_ this repo.
- **Docs live with the code.** A change and the doc describing it belong in the same commit.
- **Commit prefixes and doc language:** see [`AGENTS.md`](AGENTS.md) §5.
- **Line endings:** enforced by `.gitattributes` (`eol=lf`). On first clone run the same command on Windows / macOS / Linux:

```bash
git config --global core.autocrlf input
```
