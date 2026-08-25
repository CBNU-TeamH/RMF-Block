# AGENTS.md

> The **single entry point** for this repository. Every AI agent and teammate reads this before starting work.
> Tool-neutral (Claude / Cursor / Copilot alike). `CLAUDE.md` only imports this file.

<!-- BEGIN:nextjs-agent-rules -->

## 0. This is NOT the Next.js you know

This version (16.2.12) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

## 1. Project overview

- **What**: a LAN-based real-time document collaboration system. Full requirements: [`docs/SRS-ko.md`](docs/SRS-ko.md).
- **Who**: CBNU Team H capstone project.
- **Current stage**: this repository holds both the docs and the code — Next.js + TypeScript, single package, pnpm.
- **Architecture**: real-time sync runs on **self-hosted Yorkie (CRDT)**; the app/WS server is a single Next.js custom server (REST + WebSocket) owning business logic and state relay. **Yorkie also owns document persistence and version history** — it runs on MongoDB, and history comes from its revision API. MongoDB is Yorkie's internal store and the app never connects to it; the app's own state lives in host-held JSON files under `.data/` — chat today, with workspace metadata and auth records planned but still in-memory only (`lib/auth/session-registry.ts`). See [`docs/SRS-ko.md`](docs/SRS-ko.md) §2.3.2 and [`docs/adr/002-persistence-on-yorkie-mongo.md`](docs/adr/002-persistence-on-yorkie-mongo.md).

---

## 2. How we work (SDD workflow)

We adopt [Spec-Driven Development](https://github.com/github/spec-kit) **as a methodology only** — no slash commands, no extra tooling. Work follows this order.

| Step | Do | Where |
| --- | --- | --- |
| 0. Principles | Read the [coding principles](#3-coding-principles) below plus the code conventions | `docs/` |
| 1. Spec | Confirm requirements and conventions | `docs/SRS-ko.md`, `docs/` |
| 2. Plan | Write down the approach and trade-offs (no over-engineering) | inside the task doc |
| 3. Task | Register the work as a todo + lessons pair from the templates | `tasks/active/` ([conventions](tasks/active/README.md)) |
| 4. Build | Define success criteria, then iterate until they are met | `app/` |
| 5. Done | `pnpm tasks:archive <slug>` | → `tasks/archive/YYYY/MM/` |

The overall plan lives in [`ROADMAP.md`](ROADMAP.md).

---

## 3. Coding principles

The four [Karpathy guidelines](https://github.com/multica-ai/andrej-karpathy-skills). They apply to whoever writes or changes code, human or AI.

1. **Think before coding** — do not assume. When something is ambiguous, surface the trade-offs and ask instead of guessing.
2. **Simplicity first** — the minimum code that solves the problem. No unrequested features, abstractions, or defensive code.
3. **Surgical changes** — touch only what needs touching. Leave unrelated code and formatting alone, clean up only your own traces, and follow the existing style.
4. **Goal-driven execution** — turn the task into verifiable success criteria and iterate until they are met.

---

## 4. Doc routing

Which document to open for which job.

| When you need | Read |
| --- | --- |
| Requirements · module design · code conventions · test strategy · ADRs | [`docs/`](docs/) |
| Lint / format config | [`eslint.config.mjs`](eslint.config.mjs) |
| Open work and its status | [`tasks/`](tasks/) (`active/`, `archive/`) |
| The overall plan | [`ROADMAP.md`](ROADMAP.md) |
| Skills for Claude Code | [`skills/`](skills/) |
| How to run the app (Docker, LAN setup) | [`README.md`](README.md) |
| Host/guest auth entry flow deep-dive | [`HOST-GUEST-ENTRY-ko.md`](HOST-GUEST-ENTRY-ko.md) |

---

## 5. Team conventions

- **Commit prefixes**: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`.
- **Doc language**: English. The exception is [`docs/SRS-ko.md`](docs/SRS-ko.md), the team's agreed requirements document, which stays in Korean.
- **Never commit secrets or credentials.**
- **Do not change agreed documents alone** — e.g. [`docs/SRS-ko.md`](docs/SRS-ko.md) changes only after the team agrees.

---

## 6. Branching and pull requests

- **`main` is always releasable.** Never commit to it directly — branch, then open a PR.
- **One branch per task**, named `<type>/<slug>` with the same prefixes as commits: `feat/block-lock`, `fix/presence-flicker`, `docs/adr-realtime`.
- **One PR per task**, and its description links the task doc in `tasks/active/` or the GitHub issue it closes.
- **Before merging**: `pnpm lint`, `pnpm test` and `pnpm build` pass. CI enforces this — `lint · test · build` and `container smoke test` are required checks on `main`, and both run on every PR.
- **Squash merge** — the only method `main` allows. Give the squashed commit a prefixed title, so `main` reads as one line per task. The branch is deleted automatically.
- **Review**: one approval, and [`.github/CODEOWNERS`](.github/CODEOWNERS) makes it the other maintainer's. An approval does not carry over to commits pushed after it. An org owner may bypass this to merge when waiting would block the team — direct pushes to `main` stay blocked either way — and says so in the PR afterwards.

---

## 7. TODO / undecided

- [x] Write `docs/adr/001-realtime-sync.md` recording the Yorkie + WS server + local Git decision. Done — see [`docs/adr/001-realtime-sync.md`](docs/adr/001-realtime-sync.md) and [`docs/design/architecture.md`](docs/design/architecture.md). **Its Git half is now superseded by [`docs/adr/002-persistence-on-yorkie-mongo.md`](docs/adr/002-persistence-on-yorkie-mongo.md)** — persistence and history moved to Yorkie + MongoDB.
- [x] Define block Lock (occupancy): how it is acquired and released, and whether a block held by another user can be edited. Defined in `docs/SRS-ko.md` SIR003 and `FR-022-06` — occupancy is acquired on selection/cursor placement and released on deselection, and does not block another user from editing.
- [x] Set the grace period for edits during a disconnect. Done — 30s, see `docs/SRS-ko.md` UC-022 비고.
- [ ] Set the load-test baseline that `docs/SRS-ko.md` §2.4 defers.
- [x] Confirm whether `FR-022-05, 07, 08, 10, 11` were intentionally removed or are missing requirements. Done — confirmed intentional, noted in `docs/SRS-ko.md` 3.3.4.
- [ ] Decide block/text color and styling (block background/text color, and whether it extends to inline text ranges) — not in `docs/SRS-ko.md` today. Deferring is low-risk: block-level color is an additive `content` field per type, and inline color can ride `yorkie.Text`'s native range-style attributes without changing the block schema, so it doesn't block finishing the base 12-type schema in `docs/design/document-editing.md`.
- [x] Reconcile Yorkie MongoDB. Decided in favour of Mongo — [`docs/adr/002-persistence-on-yorkie-mongo.md`](docs/adr/002-persistence-on-yorkie-mongo.md) makes Yorkie + MongoDB the persistence and history layer, and the docs now match the SRS §2.1 diagram. `docker-compose.yml` runs Yorkie with `--mongo-connection-uri` against a Mongo service, so document durability is wired.
- [ ] Decide what triggers the App/WS Server to call Yorkie's `createRevision` — Yorkie itself never auto-snapshots, so a revision is only ever created by an explicit call; the open question is what event or cadence in the app should make that call. No FR or UC covers version history today, so nothing forces the answer yet — see issue #28.
- [x] Decide whether the App/WS Server keeps a Yorkie `Watch` subscription at all. Not needed — its only purpose was driving the deleted delayed-write trigger, and Mongo now provides durability directly.
