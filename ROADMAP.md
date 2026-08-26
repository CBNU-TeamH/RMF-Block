# Roadmap

Phased by use-case priority and technical dependency, not by calendar date. A phase starts once its prerequisites are demonstrably working, not on a fixed schedule. Every phase lists the use cases it covers — see [`docs/SRS-ko.md`](docs/SRS-ko.md) §3.1 for the full scenarios and §3.3 for the functional requirements (`FR-...`) each one expects.

Architecture context: [`docs/adr/002-persistence-on-yorkie-mongo.md`](docs/adr/002-persistence-on-yorkie-mongo.md) and the parts of [`docs/adr/001-realtime-sync.md`](docs/adr/001-realtime-sync.md) it leaves standing, plus [`docs/design/architecture.md`](docs/design/architecture.md).

## Phase 0 — Foundation

Everything later phases assume exists.

- Self-hosted Yorkie server running (Docker), **backed by MongoDB** (`--mongo-connection-uri`), reachable from the app. Not optional: on MemDB every document is wiped on restart, and since ADR-002 there is no other durable store.
- App/WS Server scaffolding (Business Logic component + the `.data/` JSON store, per `docs/design/architecture.md`).
- Architecture baseline: ADR-001 + ADR-002 + `docs/design/architecture.md`.
- Workspace create (UC-010, basic flow only — no restore yet) and join (UC-020), minimal enough to get two browser sessions into the same workspace. This is infrastructure for every phase after it, not the full UC-010/011 scope — the rest of workspace management lands in Phase 2.

**Exit criteria**: two clients can join the same workspace and see each other in a connected-user list, and restarting the Yorkie container leaves an attached document's content intact (proves Mongo is actually wired, rather than surfacing as a Phase 1 failure).

## Phase 1 — Core document collaboration

The system's core value: shared block editing. Highest UC priority (매우 높음).

- Block create/edit/delete/move (UC-022), including the Yorkie document schema for all block types in SRS §4.1.
- Block occupancy display (SIR003, FR-022-06) — visual only, never a lock.
- File-block upload (FR-022-13/14).
- Reconnect resync during a disconnect (FR-022-12, NFR-REL-001), using the 30s grace period fixed in `docs/SRS-ko.md` UC-022 비고.

**Exit criteria**: two clients editing the same document see each other's block changes in under a second (NFR-PER-002); restarting the app server leaves every open document intact; and restarting the Yorkie container brings back the same document content from MongoDB. The two restarts are separate failure modes and are tested separately.

## Phase 2 — Workspace & document lifecycle management

Management features layered on top of an already-working workspace and editor — not prerequisites for anything else, so they land after Phase 1 rather than alongside Phase 0's bootstrap.

- Document create/rename/move/delete and the document tree (UC-021, UC-023).
- Workspace restore-on-restart (remainder of UC-010).
- Guest kick and workspace password change (UC-011).

**Exit criteria**: a host can fully administer a workspace and its document tree without touching the block editor itself.

## Phase 3 — Collaboration awareness

- Focus following / presenter mode (UC-030) — the most complex feature after the core editor: session state, follower input lock, presenter tools, pause/resume.
- User tracking / jump-to-user (UC-040).

**Exit criteria**: a presenter can drive every follower's view in real time, and any user can jump to and back from another user's position.

## Phase 4 — File & chat features

- Workspace-wide embedded-file manager (UC-050).
- Real-time chat, including file/URL/block-link attachments (UC-060, UC-061).
- Floating view (UC-070).
- In-app file viewer (UC-080).

**Exit criteria**: all UC-050 through UC-080 scenarios in the SRS pass end to end.

## Phase 5 — Hardening

- Load-test baseline for the 8-user assumption (NFR-PER-001/006) — open item, `AGENTS.md` §7.
- Security pass: input validation, upload restrictions, unauthorized-access checks (NFR-SEC-003/004/005).
- Crash/restart recovery verification (NFR-SAF-003, NFR-REL-002) — against Yorkie/MongoDB for document content and `.data/` for app state, the two stores ADR-002 leaves.
- Close out the remaining `AGENTS.md` §7 item that belongs here: the load-test baseline above. The other two open items — block/text colour (#6) and what triggers `createRevision` (#23) — are design decisions, not hardening, and land with the modules that need them.

**Exit criteria**: NFRs in SRS §3.4 are verified, not just assumed.
