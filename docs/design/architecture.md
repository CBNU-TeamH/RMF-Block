# System Architecture & Component Interfaces

- **Status**: Baseline — component boundaries and interfaces only.
- **Owns**: none — §0 below says why: this document fixes boundaries, not any module's internal
  rationale, so it makes no source-path claim for the ownership checker to track.
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
       │                               │ + revision API
       ▼                               ▼
┌─────────────────────┐        ┌─────────────────────┐
│  App / WS Server    │ ◀───── │   Yorkie Server     │
│  Business Logic     │  auth  │   (self-hosted)     │
│                     │webhook │                     │
└──────────┬──────────┘        └──────────┬──────────┘
           │                              │
           │ chat, members,               │ document state
           │ catalogue, files             │ + revisions
           ▼                              ▼
┌─────────────────────┐        ┌─────────────────────┐
│    .data/*.json     │        │      MongoDB        │
│  (App/WS Server)    │        │  (Yorkie's store)   │
└─────────────────────┘        └─────────────────────┘
```

## 3. Interface contracts

### (a) Client Sync Component ↔ Yorkie Server

The wire protocol is Yorkie's own client SDK — not ours to design. What we do own is the **shape of data placed inside it**:

- **Document schema** (CRDT document content — persisted, shared): every block has a common envelope `{ id, type }`; `type` is one of the twelve block types in SRS §4.1 (텍스트, 제목, 목록, 체크리스트, 인용문, 코드, 구분선, 파일, 이미지, PDF, 문서 링크, 블록 링크). Each type owns its own `content` payload shape. Block order is the Yorkie Array position itself, not a stored field — there is no `order` field. Field-level detail is settled in [`document-editing.md`](document-editing.md), which covers all twelve types.
- **Presence schema** (ephemeral, per-connected-client — not persisted): the fields are in `lib/presence/types.ts` and `lib/presence/occupancy.ts`, explained in [`presence-and-focus.md`](presence-and-focus.md). `activeBlockId` is the block-occupancy signal (SIR003 — display-only, never a lock, per FR-022-06).

### (b) Client ↔ App/WS Server (API groups)

Transport is REST + WebSocket. Grouped by concern; full request/response schemas are written when each group's module is built. Both WebSocket upgrade paths (chat and workspace) require a live session or the host secret to complete at all — an unauthenticated client gets a 401 before the handshake, never reaching the hub ([ADR-006](../adr/006-workspace-chat-socket-auth.md)).

SOIR001 is easy to misread here: it requires realtime sync over "WebSocket 기반 실시간 통신", but document changes and presence never cross this boundary — they go straight from the browser to Yorkie over Connect / gRPC-Web on ordinary HTTP, with `WatchDocument` as a server-streaming response rather than a socket. REST and WebSocket are what *this* boundary carries; the socket carries `session:revoked`, chat and the document-tree events (§3(d)). `docs/SRS-ko.md` is a team-agreed document and changes only with the team's agreement (`AGENTS.md` §5); SOIR001's wording was corrected under that agreement — [issue #36](https://github.com/CBNU-TeamH/RMF-Block/issues/36).

| Group | Carries | Traceability |
| --- | --- | --- |
| Workspace API | create/join/reopen, guest kick, password change | SIR001, SIR002, SIR011 |
| Document Tree API | doc create/rename/move/delete, tree listing | SIR003 (tree part) |
| File API | upload, download, workspace-wide embedded-file listing, preview metadata | SIR005, SIR008 |
| Chat API | send message (text/URL/file/block-link), history, chat-file listing | SIR006, SIR010 |

The connected-user list is **not** in the table above: it crosses boundary (a), Client ↔ Yorkie, with the browser attaching to a reserved `workspace` document directly. The App/WS Server's only part is handing each browser its own `{ id, nickname, colorTag }` as server-rendered props (`app/(workspace)/layout.tsx`), which passes them to the one provider that owns the browser's Yorkie connection.

Presence and focus-following are not an API group: presenting is a Yorkie presence field and following is client-local state, so they ride the client-to-Yorkie channel and the App/WS Server tracks no session state for them ([`presence-and-focus.md`](presence-and-focus.md)).

> in this section b, Workspace API means join our service (rmf-block) not meaning yorkie client attaching.

### (c) App/WS Server ↔ Yorkie Server (persistence and history)

There is no internal persistence module. Document durability is Yorkie's, and crash/restart recovery (NFR-REL-002, NFR-SAF-003) needs no code on our side — Yorkie reloads its own state from MongoDB on start (ADR-002).

What crosses this boundary for version history is authorisation only: the browser calls Yorkie's revision API through its own `Client`, and Yorkie asks this server's auth webhook whether the session is live. Which calls are used and where revisions come from: [`version-history.md`](version-history.md).

A revision outlives the document it belongs to, but only by id, so deleting a document has to keep its revision ids: [`version-history.md`](version-history.md#deleting-a-document).

**Decided:** the App/WS Server does not keep a `Watch` subscription on documents — Mongo provides durability directly (ADR-002).

### (d) App/WS Server ↔ `.data/` JSON files

App-owned state is whole JSON files on the host filesystem under `.data/` — chat history, members, the document catalogue and file metadata; sessions stay in memory on purpose (a session id on disk would be a permanent bearer token), and workspace metadata is still to come. The repository pattern (sync vs. queued writes, atomic rename) is in [`chat.md`](chat.md), "Storage"; why the document catalogue exists beside Yorkie is in [`document-editing.md`](document-editing.md#why-a-catalogue-beside-yorkie).

The catalogue is a **tree**, not a list: a document carries a `parentId`, `null` at the root (UC-021 E1a). A catalogue written before sub-documents existed has no such field, and a missing one reads as `null` — that is the whole migration, no rewrite and no version marker. Name uniqueness is per-parent, which is what FR-021-03's "동일 위치 내" asks for.

**Tree edits reach other clients over the WebSocket hub, not through Yorkie.** Every catalogue write broadcasts `document:created`, `document:changed` or `document:deleted` (events listed in [ADR-005](../adr/005-custom-server-rest-ws.md); hub design in [`chat.md`](chat.md)), and open clients apply it — a tree edit is one short server-authoritative operation, so last-write-wins on one JSON file fits, not a CRDT. A delete broadcasts **every** id it removed, because FR-023-06 takes the subtree and a client told only about the parent would keep drawing its children.

This store is separate from Yorkie's. Restoring a workspace after a restart requires both sides to have survived — documents in MongoDB, app state in `.data/`. Both are now named volumes — `mongo-data` for Yorkie's store, `app-data` for `.data/` — so a container recreation leaves either intact and only `docker compose down -v` clears them (#22).

### Startup: how the app refuses to run

`instrumentation.ts` registers Yorkie's auth webhook before the first request is served, and in
production a failure there is fatal. Why it exits rather than throws, and the dev behaviour:
[`api.md`](api.md#2-rpc--rmf-block-server--yorkie).

## 4. Decided vs. deferred

| Decided here / already fixed | Deferred to module design |
| --- | --- |
| Block occupancy ≠ edit lock (SIR003, FR-022-06) | |
| Yorkie owns realtime sync **and** document persistence/history (ADR-002) | Load-test baseline *numbers* (SRS §2.4) — how to measure them is settled in [`PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md`](../PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md) |
| The server keeps **no** Yorkie `Watch` subscription (ADR-002) | |
| MongoDB is Yorkie's store alone; the app never connects to it (ADR-002) | |
| App state lives in `.data/` JSON, not in Yorkie or Mongo — chat, members, the document catalogue and files; workspace metadata still to come | |
| Component boundaries and API groups (this doc) | |
| Presence and focus ride the client-to-Yorkie channel; no server-side present/follow state ([`presence-and-focus.md`](presence-and-focus.md)) | |
| App/WS Server runs as one process — a Next.js custom server handling REST + WebSocket together, not split across services | |
| Reconnect grace period = 30s (UC-022 비고) | |
| Block schema field-level detail per type (`document-editing.md`, all 12 types agreed) | |
| Document key = plain id (no prefix); revoke-all = container restart — see the auth model in [`api.md`](api.md#authentication-model) | |
| FR-022 numbering gap (05/07/08/10/11) confirmed intentional | |

## 5. Relation to task workflow

Per the SDD workflow in `AGENTS.md` §2: a module's detailed design is written as `docs/design/<module>.md` right before that module is registered as a task in `tasks/active/`. The task's `todo.md` **Design** field points to it. This document is the only thing that exists before any module task starts — everything else in `docs/design/` is written just-in-time.
