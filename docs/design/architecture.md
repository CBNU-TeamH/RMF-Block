# System Architecture & Component Interfaces

- **Status**: Baseline — component boundaries and interfaces only.
- **Related**: [`docs/SRS-ko.md`](../SRS-ko.md) §2.1, §3.2 (인터페이스 요구사항); [`docs/adr/001-realtime-sync.md`](../adr/001-realtime-sync.md)

## 0. Scope

This document fixes **what talks to what, and what crosses each boundary**. It does not define how any single component works internally — that is written as `docs/design/<module>.md` immediately before that module's implementation task starts (see §5). Read this before starting any module so new work lands on the agreed seams instead of inventing its own.

Full endpoint-level API specs are out of scope here too — SRS §1.2 already assigns that to a separate API design doc written during development. This document defines the API **groups** and what data category each carries, so parallel modules agree on shape before any one of them is built in detail.

## 1. Component inventory

Mapped from SRS §2.1's six components onto where each one runs:

| Component | Runs on | SRS origin |
| --- | --- | --- |
| Document Editing | Client | 문서 편집 컴포넌트 |
| Workspace Management | Client | 워크스페이스 관리 컴포넌트 |
| Collaboration Support | Client | 협업 지원 컴포넌트 |
| Block/File Management | Client | 블록/파일 관리 컴포넌트 |
| Sync | Client (SDK wrapper) | 동기화 컴포넌트 |
| Business Logic | App/WS Server | 동기화 컴포넌트 일부 + W2 |
| Git Management | App/WS Server | Git 관리 컴포넌트 (W1) |
| Yorkie Server | External, self-hosted | Yorkie 실시간 동기화 엔진 |
| Local Git repository | External, server filesystem | 서버 로컬 Git 저장소 |

## 2. Architecture diagram

```
┌─────────────── Client (per browser) ───────────────┐
│ Document Editing │ Workspace Mgmt │ Collab Support  │
│ Block/File Mgmt   │        Sync (Yorkie SDK)        │
└──────┬───────────────────────────────┬──────────────┘
       │ API / WebSocket               │ CRDT sync + Presence
       ▼                               ▼
┌─────────────────────┐        ┌───────────────────┐
│  App / WS Server     │        │   Yorkie Server    │
│  Business Logic ──┐  │        │  (self-hosted)     │
│  Git Management  ◀┘  │        └───────────────────┘
└──────────┬───────────┘
           │ delayed write + commit
           ▼
┌─────────────────────┐
│ Server filesystem     │
│  (.md) → local Git    │
└─────────────────────┘
```

## 3. Interface contracts

### (a) Client Sync Component ↔ Yorkie Server

The wire protocol is Yorkie's own client SDK — not ours to design. What we do own is the **shape of data placed inside it**:

- **Document schema** (CRDT document content — persisted, shared): every block has a common envelope `{ id, type, order }`; `type` is one of the twelve block types in SRS §4.1 (텍스트, 제목, 목록, 체크리스트, 인용문, 코드, 구분선, 파일, 이미지, PDF, 문서 링크, 블록 링크). Each type owns its own `content` payload shape. Field-level detail is defined when the Document Editing module's design doc is written.
- **Presence schema** (ephemeral, per-connected-client — not persisted): `{ userId, displayName, colorTag, documentId, activeBlockId, viewport, role }`. `activeBlockId` is the block-occupancy signal (SIR003 — display-only, never a lock, per FR-022-06). `role` distinguishes presenter/follower for focus-following (SIR004).

### (b) Client ↔ App/WS Server (API groups)

Transport is REST + WebSocket (SOIR001). Grouped by concern; full request/response schemas are written when each group's module is built.

| Group | Carries | Traceability |
| --- | --- | --- |
| Workspace API | create/join/reopen, guest kick, password change, connected-user list | SIR001, SIR002, SIR011 |
| Document Tree API | doc create/rename/move/delete, tree listing | SIR003 (tree part) |
| File API | upload, download, workspace-wide embedded-file listing, preview metadata | SIR005, SIR008 |
| Chat API | send message (text/URL/file/block-link), history, chat-file listing | SIR006, SIR010 |
| Presence/Follow API | start/stop presenting, join/pause/resume follow, jump-to-user, presenter-tool highlights | SIR004, SIR009 |

Presence/Follow is server-mediated business logic, not raw Yorkie Presence: SRS UC-030/UC-040 describe multi-step session state (start presenting → notify others → join → lock follower input → pause/resume) that needs the App/WS Server to track, beyond what a per-client Presence field expresses.

> in this section b, Workspace API means join our service (rmf-block) not meaning yorkie client attaching.

### (c) App/WS Server ↔ Git Management Component

Internal module boundary, not a network call. Two operations only, matching what ADR-001 and the NFRs actually require:

- `scheduleWrite(documentId)` — debounced trigger; materializes the current Yorkie document state to `.md` and commits it. Debounce interval is undecided (`AGENTS.md` §7).
- `restoreLatest(documentId)` — reads the last commit back into a Yorkie document on server start, for crash/restart recovery (NFR-REL-002, NFR-SAF-003).

### (d) Git Management Component ↔ local Git repository / filesystem

Standard Git operations (write files, `add`, `commit`) and standard filesystem reads. Commit message convention and commit granularity are decided at this module's design time.

### (e) Yorkie document state ↔ Markdown file (materialization)

The one hard constraint fixed here: **every block type must have a defined, round-trippable mapping to a Markdown representation**, so `restoreLatest` can reconstruct a Yorkie document from a commit. The mapping table itself belongs to the Git Management Component's module design, not here.

## 4. Decided vs. deferred

| Decided here / already fixed | Deferred to module design |
| --- | --- |
| Block occupancy ≠ edit lock (SIR003, FR-022-06) | Reconnect grace period value ("n ms", UC-022 비고 — `AGENTS.md` §7) |
| Yorkie owns realtime sync; Git is off the realtime path (ADR-001) | Git write-debounce interval (ADR-001) |
| Component boundaries and API groups (this doc) | Block schema field-level detail per type |
| Presence carries occupancy + role; session state (present/follow) is server-owned | Yorkie↔Markdown mapping table per block type |
| | Auth/session token format for the API groups |
| | Presenter/follower session state model |
| | Load-test baseline (SRS §2.4 — `AGENTS.md` §7) |
| | FR-022 numbering gap (05/07/08/10/11 — `AGENTS.md` §7) |

## 5. Relation to task workflow

Per the SDD workflow in `AGENTS.md` §2: a module's detailed design is written as `docs/design/<module>.md` right before that module is registered as a task in `tasks/active/`. The task's `todo.md` **Design** field points to it. This document is the only thing that exists before any module task starts — everything else in `docs/design/` is written just-in-time.
