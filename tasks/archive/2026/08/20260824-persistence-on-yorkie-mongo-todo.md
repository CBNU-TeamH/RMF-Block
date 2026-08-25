# Docs: move persistence and history from Git to Yorkie + MongoDB

**Created**: 2026-08-24
**Issue**: #18
**Design**: [`docs/adr/002-persistence-on-yorkie-mongo.md`](../../docs/adr/002-persistence-on-yorkie-mongo.md) — written as part of this task, since the decision itself is the deliverable.

## Milestones

### 1. Record the decision

- **What**: a new ADR stating that Yorkie + MongoDB owns document persistence and history, that app state lives in `.data/` JSON, and precisely which parts of ADR-001 it supersedes.
- **Files**: `docs/adr/002-persistence-on-yorkie-mongo.md`, plus ADR-001's `Status` line.
- **Reuse**: ADR-001's structure and its third rejected alternative ("no durable persistence, in-memory only"), which is already the argument for running Yorkie on Mongo rather than MemDB. The revision API surface was confirmed during the July spike — `20260728-yorkie-git-spike-lessons.md`.
- **Done**: a reader of ADR-001 alone sees it is superseded, and ADR-002 names what survives instead of restating everything.

### 2. Bring the SRS in line

- **What**: remove the Git dependency, the delayed-write cycle, the Git Management Component, and the Markdown round-trip constraint; retarget history to Yorkie revisions.
- **Files**: `docs/SRS-ko.md` — §2.1 prose, scope, environment table, component list, the Mermaid diagram, §2.3.1, §2.3.2, UC-023 비고, SOIR003, NFR-SAF-003.
- **Reuse**: the §2.1 diagram already showed `Yorkie 메인 DB: MongoDB`. The prose was brought up to the diagram, not the reverse.
- **Done**: `grep -n "Git\|git\|commit\|Markdown" docs/SRS-ko.md` returns nothing.

### 3. Propagate to the design docs and entry points

- **What**: the same change everywhere it is restated.
- **Files**: `docs/design/architecture.md`, `docs/design/api.md`, `docs/design/chat.md`, `ROADMAP.md`, `AGENTS.md`, `README.md`.
- **Reuse**: `lib/chat/chat-repository.ts` is already the `.data/` JSON pattern; the docs now name it as the reference implementation rather than describing it as an analogy to the git watcher.
- **Done**: no doc claims Git persists anything, and every ADR-001 persistence citation points at ADR-002.

## Acceptance

- [x] `grep -rn "Git\|git" docs/ AGENTS.md ROADMAP.md README.md` returns only this repo's own VCS conventions, ADR-001 as superseded history, and `HOST-GUEST-ENTRY-ko.md`'s narrative
- [x] The §2.1 Mermaid block renders with no phantom node and no orphaned `style` rule
- [x] SRS §2.1 component numbering and §2.3.2 dependency numbering are both contiguous after the deletions
- [x] The requirements that leaned on the deleted §2.3.2 durability contract (FR-010-05, SIR001, SOIR002, NFR-SAF-001/003, NFR-REL-002) each still have a stated basis
- [x] `pnpm lint && pnpm test && pnpm build` pass
- [x] PR links #18 and ticks the agreed-docs checkbox

## Cross-cutting

Requirements touched: SOIR003 (retitled, ID kept for traceability), NFR-SAF-003 (redefined against Yorkie's persisted state), UC-023 비고 (deleted-document history claim removed — unverified under Yorkie).

Deliberately out of scope, each becoming its own issue: the `docker-compose.yml` mongo service and volumes; deleting `server/watcher.mts`, `lib/pm-schema.ts` and the `prosemirror-markdown` dependency; the missing FR/UC for version history; and whether Yorkie revisions survive `document.remove()`.

Two open questions are recorded rather than answered — the revision cadence, and whether the server keeps a Yorkie `Watch` subscription. They are in ADR-002, `architecture.md` §4, `api.md` §2, and `AGENTS.md` §7.

## Review

Shipped: ADR-002, the SRS Git removal (§2.1/§2.3.1/§2.3.2, UC-023 비고, SOIR003, NFR-SAF-003), and the propagation to `architecture.md`/`api.md`/`ROADMAP.md`/`AGENTS.md`/`README.md`. Nothing was cut from the milestones as scoped.

What moved to their own issues, as planned: the `docker-compose.yml` mongo service and volumes (#21, shipped), the missing FR/UC for version history (#23, open), whether Yorkie revisions survive `document.remove()` (#24, verified and closed), and `.data/` durability across container recreation (#22, open). This docs-sync PR closed out the stale "MemDB"/Watch-subscription language that lingered in the docs after #21 and #24 landed.
