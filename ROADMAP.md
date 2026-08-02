# Roadmap

Phased by use-case priority and technical dependency, not by calendar date. A phase starts once its prerequisites are demonstrably working, not on a fixed schedule. Every phase lists the use cases it covers — see [`docs/SRS-ko.md`](docs/SRS-ko.md) §3.1 for the full scenarios and §3.3 for the functional requirements (`FR-...`) each one expects.

Architecture context: [`docs/adr/001-realtime-sync.md`](docs/adr/001-realtime-sync.md), [`docs/design/architecture.md`](docs/design/architecture.md).

## Phase 0 — Foundation

Everything later phases assume exists.

- Self-hosted Yorkie server running (Docker), reachable from the app.
- App/WS Server scaffolding (Business Logic + Git Management components, per `docs/design/architecture.md`).
- Architecture baseline: ADR-001 + `docs/design/architecture.md` (this work).
- Workspace create (UC-010, basic flow only — no restore yet) and join (UC-020), minimal enough to get two browser sessions into the same workspace. This is infrastructure for every phase after it, not the full UC-010/011 scope — the rest of workspace management lands in Phase 2.

**Exit criteria**: two clients can join the same workspace and see each other in a connected-user list.

## Phase 1 — Core document collaboration

The system's core value: shared block editing. Highest UC priority (매우 높음).

- Block create/edit/delete/move (UC-022), including the Yorkie document schema for all block types in SRS §4.1.
- Block occupancy display (SIR003, FR-022-06) — visual only, never a lock.
- File-block upload (FR-022-13/14).
- Delayed-write → Git commit cycle (Git Management Component, per ADR-001 and `scheduleWrite`/`restoreLatest` in `docs/design/architecture.md`).
- Reconnect resync during a disconnect (FR-022-12, NFR-REL-001). Grace-period value is still open — `AGENTS.md` §7.

**Exit criteria**: two clients editing the same document see each other's block changes in under a second (NFR-PER-002), and a server restart restores the last committed state.

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
- Crash/restart recovery verification (NFR-SAF-003, NFR-REL-002).
- Close out remaining `AGENTS.md` §7 items: reconnect grace period, load-test baseline, and confirming whether `FR-022-05/07/08/10/11` are intentionally absent.

**Exit criteria**: NFRs in SRS §3.4 are verified, not just assumed.
