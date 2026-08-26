# System Architecture & Component Interfaces

- **Status**: Baseline — component boundaries and interfaces only.
- **Related**: [`docs/SRS-ko.md`](../SRS-ko.md) §2.1, §3.2 (인터페이스 요구사항); [`docs/adr/002-persistence-on-yorkie-mongo.md`](../adr/002-persistence-on-yorkie-mongo.md) (supersedes [ADR-001](../adr/001-realtime-sync.md) on persistence)

## 0. Scope

This document fixes **what talks to what, and what crosses each boundary**. It does not define how any single component works internally — that is written as `docs/design/<module>.md` immediately before that module's implementation task starts (see §5). Read this before starting any module so new work lands on the agreed seams instead of inventing its own.

Full endpoint-level API specs are out of scope here too — SRS §1.2 already assigns that to a separate API design doc written during development. This document defines the API **groups** and what data category each carries, so parallel modules agree on shape before any one of them is built in detail.

## 1. Component inventory

Mapped from SRS §2.1's five components onto where each one runs, plus the external systems they depend on:

| Component | Runs on | SRS origin |
| --- | --- | --- |
| Document Editing | Client | 문서 편집 컴포넌트 |
| Workspace Management | Client | 워크스페이스 관리 컴포넌트 |
| Collaboration Support | Client | 협업 지원 컴포넌트 |
| Block/File Management | Client | 블록/파일 관리 컴포넌트 |
| Sync | Client (SDK wrapper) | 동기화 컴포넌트 |
| Business Logic | App/WS Server | 동기화 컴포넌트 일부 + W2 |
| Yorkie Server | External, self-hosted | Yorkie 실시간 동기화 엔진 |
| MongoDB | External, Yorkie's own store | MongoDB (Yorkie 내부 저장소) |
| `.data/` JSON files | App/WS Server filesystem | 호스트 로컬 JSON 저장소 |

MongoDB is Yorkie's internal store — the App/WS Server never connects to it, and reaches document state and revisions only through Yorkie (ADR-002 Decision 3).

## 2. Architecture diagram

```
┌─────────────── Client (per browser) ───────────────┐
│ Document Editing │ Workspace Mgmt │ Collab Support  │
│ Block/File Mgmt   │        Sync (Yorkie SDK)        │
└──────┬───────────────────────────────┬──────────────┘
       │ API / WebSocket               │ CRDT sync + Presence
       ▼                               ▼
┌─────────────────────┐        ┌─────────────────────┐
│  App / WS Server    │ ─────▶ │   Yorkie Server     │
│  Business Logic     │revision│   (self-hosted)     │
│                     │  API   │                     │
└──────────┬──────────┘        └──────────┬──────────┘
           │                              │
           │ chat, workspace,             │ document state
           │ auth records                 │ + revisions
           ▼                              ▼
┌─────────────────────┐        ┌─────────────────────┐
│    .data/*.json     │        │      MongoDB        │
│  (App/WS Server)    │        │  (Yorkie's store)   │
└─────────────────────┘        └─────────────────────┘
```

## 3. Interface contracts

### (a) Client Sync Component ↔ Yorkie Server

The wire protocol is Yorkie's own client SDK — not ours to design. What we do own is the **shape of data placed inside it**:

- **Document schema** (CRDT document content — persisted, shared): every block has a common envelope `{ id, type }`; `type` is one of the twelve block types in SRS §4.1 (텍스트, 제목, 목록, 체크리스트, 인용문, 코드, 구분선, 파일, 이미지, PDF, 문서 링크, 블록 링크). Each type owns its own `content` payload shape. Block order is the Yorkie Array position itself, not a stored field — the `order` originally sketched here was dropped for that reason. Field-level detail is settled in [`document-editing.md`](document-editing.md), which covers all twelve types.
- **Presence schema** (ephemeral, per-connected-client — not persisted): `{ userId, displayName, colorTag, documentId, activeBlockId, viewport, role }`. Shipped so far is the identity subset, under different names: `{ id, nickname, colorTag }` (`lib/presence/types.ts`, reusing `WorkspaceMember` rather than minting a second identity). `documentId`, `activeBlockId`, `viewport` and `role` are design-only, pending the Document Editing and Presence/Follow modules. `activeBlockId` is the block-occupancy signal (SIR003 — display-only, never a lock, per FR-022-06). `role` distinguishes presenter/follower for focus-following (SIR004).

### (b) Client ↔ App/WS Server (API groups)

Transport is REST + WebSocket (SOIR001). Grouped by concern; full request/response schemas are written when each group's module is built.

| Group | Carries | Traceability |
| --- | --- | --- |
| Workspace API | create/join/reopen, guest kick, password change | SIR001, SIR002, SIR011 |
| Document Tree API | doc create/rename/move/delete, tree listing | SIR003 (tree part) |
| File API | upload, download, workspace-wide embedded-file listing, preview metadata | SIR005, SIR008 |
| Chat API | send message (text/URL/file/block-link), history, chat-file listing | SIR006, SIR010 |
| Presence/Follow API | start/stop presenting, join/pause/resume follow, jump-to-user, presenter-tool highlights | SIR004, SIR009 |

The connected-user list is **not** in the table above: it crosses boundary (a), Client ↔ Yorkie, with the browser attaching to a reserved `workspace` document directly. The App/WS Server's only part is handing each browser its own `{ id, nickname, colorTag }` as server-rendered props (`app/(workspace)/layout.tsx`), which passes them to the one provider that owns the browser's Yorkie connection.

Presence/Follow is server-mediated business logic, not raw Yorkie Presence: SRS UC-030/UC-040 describe multi-step session state (start presenting → notify others → join → lock follower input → pause/resume) that needs the App/WS Server to track, beyond what a per-client Presence field expresses.

> in this section b, Workspace API means join our service (rmf-block) not meaning yorkie client attaching.

### (c) App/WS Server ↔ Yorkie Server (persistence and history)

There is no internal persistence module. Document durability is Yorkie's, and crash/restart recovery (NFR-REL-002, NFR-SAF-003) needs no code on our side — Yorkie reloads its own state from MongoDB on start (ADR-002).

What crosses this boundary is version history only, through Yorkie's revision API: `createRevision`, `listRevisions`, `getRevision`, `restoreRevision`. Snapshots come back as YSON.

**Decided:** the App/WS Server does not keep a `Watch` subscription on documents — the only thing that required one was the deleted delayed-write trigger, and Mongo now provides durability directly.

**Open — decide before building this:** `createRevision` is always an explicit call (Yorkie never snapshots on its own), so what remains open is which app-side event or cadence should trigger it (issue #23).

### (d) App/WS Server ↔ `.data/` JSON files

Chat history is read and written as whole JSON files on the host filesystem — `lib/chat/chat-repository.ts` is the reference implementation of the pattern, including serializing concurrent writes through one promise chain. Member records follow the same pattern in `lib/auth/member-repository.ts`, synchronously rather than through a promise chain — sync writes on one thread cannot interleave, so there is nothing for the queue to serialize. Sessions stay in memory on purpose: a session id on disk would be a permanent bearer token. Workspace metadata is still to come.

This store is separate from Yorkie's. Restoring a workspace after a restart requires both sides to have survived — documents in MongoDB, app state in `.data/`. Both are now named volumes — `mongo-data` for Yorkie's store, `app-data` for `.data/` — so a container recreation leaves either intact and only `docker compose down -v` clears them (#22).

## 4. Decided vs. deferred

| Decided here / already fixed | Deferred to module design |
| --- | --- |
| Block occupancy ≠ edit lock (SIR003, FR-022-06) | What triggers a `createRevision` call (ADR-002, issue #23) |
| Yorkie owns realtime sync **and** document persistence/history (ADR-002) | Presenter/follower session state model |
| The server keeps **no** Yorkie `Watch` subscription (ADR-002) | Load-test baseline (SRS §2.4 — `AGENTS.md` §7) |
| MongoDB is Yorkie's store alone; the app never connects to it (ADR-002) | |
| App state lives in `.data/` JSON, not in Yorkie or Mongo — chat today, workspace and auth to follow | |
| Component boundaries and API groups (this doc) | |
| Presence carries occupancy + role; session state (present/follow) is server-owned | |
| App/WS Server runs as one process — a Next.js custom server handling REST + WebSocket together, not split across services | |
| Reconnect grace period = 30s (UC-022 비고) | |
| Block schema field-level detail per type (`document-editing.md`, all 12 types agreed) | |
| Auth/session token format: access 30min / refresh 7d, document key = plain id (no prefix), revoke-all = container restart (`api.md`) — holds only while the session secret stays in memory; persisting it alongside `.data/` auth records would break it | |
| FR-022 numbering gap (05/07/08/10/11) confirmed intentional | |

## 5. Relation to task workflow

Per the SDD workflow in `AGENTS.md` §2: a module's detailed design is written as `docs/design/<module>.md` right before that module is registered as a task in `tasks/active/`. The task's `todo.md` **Design** field points to it. This document is the only thing that exists before any module task starts — everything else in `docs/design/` is written just-in-time.
