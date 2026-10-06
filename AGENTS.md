# AGENTS.md

> The **single entry point** for this repository. Every AI agent and teammate reads this before starting work.
> Tool-neutral (Claude / Cursor / Copilot alike). `CLAUDE.md` only imports this file — a tool
> that edits "the project's memory file" by name will target `CLAUDE.md` and miss the content
> that actually lives here, so check that assumption before adopting one that writes to it.

<!-- BEGIN:nextjs-agent-rules -->

## 0. This is NOT the Next.js you know

This version (16.2.12) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

## 1. Project overview

- **What**: a LAN-based real-time document collaboration system. Full requirements: [`docs/SRS-en.md`](docs/SRS-en.md) — the English copy agents read; [`docs/SRS-ko.md`](docs/SRS-ko.md) is the canonical text the team agrees on.
- **Who**: CBNU Team H capstone project.
- **Current stage**: this repository holds both the docs and the code — Next.js + TypeScript, single package, pnpm.
- **Stack**: why Yorkie and not Yjs/Automerge, why Next's App Router and not a React SPA with its own backend, and the smaller choices around them — [`docs/adr/003-stack-choices.md`](docs/adr/003-stack-choices.md).
- **Architecture**: real-time sync runs on **self-hosted Yorkie (CRDT)**, which also owns document persistence (on MongoDB — the app never connects to it) and version history; the app/WS server is one Next.js custom server (REST + WebSocket) keeping its own state as JSON under `.data/`. Sessions stay in memory, so restarting the container is the revoke path. See [`docs/design/architecture.md`](docs/design/architecture.md), [`docs/design/api.md`](docs/design/api.md), [`docs/adr/002-persistence-on-yorkie-mongo.md`](docs/adr/002-persistence-on-yorkie-mongo.md), [`docs/SRS-ko.md`](docs/SRS-ko.md) §2.3.2.

---

## 2. How we work (SDD workflow)

We adopt [Spec-Driven Development](https://github.com/github/spec-kit) **as a methodology only** — no slash commands, no extra tooling. Run `pnpm verify:docs` before touching anything — it catches doc drift (dead links, a stale task index, an ownership gap) before it compounds. Work follows this order.

| Step | Do | Where |
| --- | --- | --- |
| 0. Principles | Read the [coding principles](#3-coding-principles) below plus the code conventions | `docs/` |
| 1. Spec | Confirm requirements and conventions | `docs/SRS-en.md`, `docs/` |
| 2. Plan | Write down the approach and trade-offs (no over-engineering) | inside the task doc |
| 3. Task | Register the work as a todo + lessons pair from the templates | `tasks/active/` ([conventions](tasks/active/README.md)) |
| 4. Build | Define success criteria, then iterate until they are met | `app/` |
| 5. Done | Check the task's lessons for a "Worth extracting" item worth promoting into `docs/conventions.md` or this file, then `pnpm tasks:archive <slug>` | → `tasks/archive/YYYY/MM/` |

The overall plan lives in [`ROADMAP.md`](ROADMAP.md).

**Run and verify**: changes to server startup, auth, or networking are verified against the container (`pnpm docker:up`, which fills in `HOST_LAN_IP` — bare Compose can print a join address no guest can reach; [`README.md`](README.md)), not `pnpm dev` ([why](tasks/archive/2026/08/20260809-host-guest-entry-lessons.md)). A DOM assertion in a browser check anchors on a stable container, never a bare tag.

**Working directory and `gh`**: pass `--repo` explicitly to any `gh` command run outside this directory, or never leave it ([why](tasks/archive/2026/08/20260828-yorkie-auth-webhook-lessons.md)).

**Delegating work**: hand repo-wide fact-finding (where is X defined, which files reference Y) to a search/explore-style sub-agent when your tool has one (Claude Code's `Explore`). Small, localized edits are done directly. Judgement calls — what a thing should do, which trade-off wins — are never delegated; only whoever is actually deciding stays accountable. When a sibling project's solution is the reference, take what it defends against, not how it calls the API (wafflebase's undo: the guard against undoing past the document's own seed, not the four-line `undo()`).

---

## 3. Coding principles

The four [Karpathy guidelines](https://github.com/multica-ai/andrej-karpathy-skills). They apply to whoever writes or changes code, human or AI.

1. **Think before coding** — do not assume. When something is ambiguous, surface the trade-offs and ask instead of guessing.
2. **Simplicity first** — the minimum code that solves the problem. No unrequested features, abstractions, or defensive code.
3. **Surgical changes** — touch only what needs touching. Leave unrelated code and formatting alone, clean up only your own traces, and follow the existing style.
4. **Goal-driven execution** — turn the task into verifiable success criteria and iterate until they are met.

[`docs/conventions.md`](docs/conventions.md) is what principles 2 and 3 look like as checkable rules — five concrete shapes that behave correctly and are still wrong.

---

## 4. Doc routing

Which document to open for which job.

| When you need | Read |
| --- | --- |
| Requirements (agents) | [`docs/SRS-en.md`](docs/SRS-en.md) — a translation; [`docs/SRS-ko.md`](docs/SRS-ko.md) wins where they differ |
| Requirements · module design · ADRs · UI wireframes ([`docs/ui/`](docs/ui/)) | [`docs/`](docs/) |
| Code conventions | [`docs/conventions.md`](docs/conventions.md) |
| Test strategy | [`docs/testing.md`](docs/testing.md) |
| How each NFR-PER item gets measured (tool, rig, clock, threshold) | [`docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`](docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md) |
| Lint / format config | [`eslint.config.mjs`](eslint.config.mjs) |
| Open work and its status | [`tasks/`](tasks/) (`tasks/active/`, `tasks/archive/`) |
| The overall plan | [`ROADMAP.md`](ROADMAP.md) |
| Skills for Claude Code | [`.claude/skills/README.md`](.claude/skills/README.md) — pointer files for external plugins plus the repo's own skills; suggest one to the user, don't run it unprompted |
| Doc-code drift audit (a `drift-audit` issue is open) | [`.claude/skills/doc-drift-audit/SKILL.md`](.claude/skills/doc-drift-audit/SKILL.md) — a runbook any agent can follow |
| How to run the app (Docker, LAN setup) | [`README.md`](README.md) |
| Development setup, the checks, where things are, the path to a PR | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Host/guest auth entry flow | [`docs/design/api.md`](docs/design/api.md) — "Authentication model", "Entry gotchas" |

---

## 5. Team conventions

- **Commit prefixes**: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`.
- **Doc language**: English. The exception is [`docs/SRS-ko.md`](docs/SRS-ko.md), the team's agreed requirements document, which stays in Korean — [`docs/SRS-en.md`](docs/SRS-en.md) is its English translation, kept structurally in step by `scripts/verify-srs-sync.mjs` in CI; [`docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`](docs/PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md) is also Korean today but pending translation, not a standing exception.
- **Never commit secrets or credentials.**
- **This repository is the source of truth.** Discussion may happen elsewhere (Notion, chat); decisions land here.
- **Docs live with the code.** A change and the doc that describes it go in the same commit.
- **Do not change agreed documents alone** — e.g. [`docs/SRS-ko.md`](docs/SRS-ko.md) changes only after the team agrees, and the same PR carries the change into [`docs/SRS-en.md`](docs/SRS-en.md). A change to `SRS-en.md` alone is a translation fix and must not add or alter a requirement.

---

## 6. Branching and pull requests

- **`main` is always releasable.** Never commit to it directly — branch, then open a PR.
- **One branch per task**, named `<type>/<slug>` with the same prefixes as commits: `feat/block-lock`, `fix/presence-flicker`, `docs/adr-realtime`.
- **One PR per task**, and its description links the task doc in `tasks/active/` or the GitHub issue it closes.
- **Before opening a PR**: start the description from [`.github/pull_request_template.md`](.github/pull_request_template.md) verbatim (an archive-only PR starts from [`.github/PULL_REQUEST_TEMPLATE/archive.md`](.github/PULL_REQUEST_TEMPLATE/archive.md) instead — fill it in and pass it with `--body-file`; `--template` works only in interactive `gh`) — don't write one from scratch (`gh pr create --body` skips the template entirely; open the file and fill it in). If `/code-review low` and `/simplify` haven't run yet this task, run them now rather than deferring — the template's checklist assumes they have; depth and model rationale in [`.claude/skills/README.md`](.claude/skills/README.md). Order checks by cost: a script (`pnpm verify:fast`, the comment budget, `verify:docs`) before any model pass.
- **Before merging**: `pnpm lint`, `pnpm test` and `pnpm build` pass. CI enforces this — `lint · test · build` and `container smoke test` (the Yorkie invariants, the container smoke test and the E2E layer, on one stack) are required checks on `main`. The `docs` job (doc checks and the comment budget) runs on every PR too but is deliberately not required, and neither is the E2E step yet (`continue-on-error` until it has run green): a red run is a signal to act on, not a merge block.
- **Squash merge** — the only method `main` allows. Give the squashed commit a prefixed title, so `main` reads as one line per task. The branch is deleted automatically.
- **Review**: one approval, and [`.github/CODEOWNERS`](.github/CODEOWNERS) makes it the other maintainer's. An approval does not carry over to commits pushed after it. An org owner may bypass this to merge when waiting would block the team — direct pushes to `main` stay blocked either way — and says so in the PR afterwards.

---

## 7. TODO / undecided

Only what is **still open**. Decisions already settled are recorded where they are used —
[`docs/design/architecture.md`](docs/design/architecture.md) §4 "Decided vs. deferred" holds the
list, and the ADRs hold the reasoning. Keeping settled items here as ticked boxes just made this
section the third place to look.

- [ ] Decide block/text color and styling — [#6](https://github.com/CBNU-TeamH/RMF-Block/issues/6).
