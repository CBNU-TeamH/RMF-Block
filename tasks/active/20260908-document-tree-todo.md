# The document tree: sub-documents, rename, move, delete, and the link block

**Created**: 2026-09-08
**Issue**: none — FR-021-02/03/06 and all of FR-023 are unbuilt requirements.
**Design**: [`docs/design/architecture.md`](../../docs/design/architecture.md) §3(d) for where the catalogue lives, [`api.md`](../../docs/design/api.md) §1 for the endpoints, [`document-editing.md`](../../docs/design/document-editing.md) §11 for the link block.

Today the catalogue is a flat list with one operation: create. UC-021 E1a and every one of
FR-023's seven clauses are missing, and SRS type 11 (`doc-link`) has nowhere to point.

## The decision this rests on

**The tree stays in `.data/documents/documents.json` and reaches other clients over the WebSocket
hub — it does not move into Yorkie.** ADR-002 is explicit that app-owned state is not CRDT
document content, `page.tsx` reads the catalogue server-side (a Yorkie document could not be read
there), and `chat` already proves the shape: REST writes, the hub broadcasts, clients apply. What
Yorkie owns is a document's *content*; what this owns is which documents exist and where.

FR-021-06 and FR-023-07 ask for realtime reflection, not for a CRDT. A tree edit is a single
short server-authoritative operation, not concurrent character editing, so last-write-wins on one
JSON file is the honest fit.

## Milestones

### 1. The model grows a parent, and uniqueness becomes local

- **What**: `WorkspaceDocument` gains `parentId: string | null`; a name is unique **within its
  parent**, not workspace-wide.
- **Files**: `lib/documents/documents.ts`, `lib/documents/tree.ts` (new, pure), tests for both.
- **Reuse**: `uniqueName` exists and already appends `(2)`. What changes is its search space.
- **Done**: two documents named `회의록` can exist under different parents, and cannot under one.

**This changes shipped behaviour.** FR-021-03 says "동일 위치 내" and today's check is global —
so a name that is refused a suffix today will get one, and vice versa. Called out because the
existing `uniqueName` test asserts the global rule and has to change with it.

**`parentId` is nullable, not a sentinel root.** A root document has no parent, and a `null` says
that without inventing a row nothing else refers to. Migration is therefore reading an old file
and treating a missing `parentId` as `null` — no rewrite, no version field.

### 2. Rename, move, delete (FR-023-01~06)

- **What**: three operations on the catalogue, with delete cascading to descendants (FR-023-06).
- **Files**: `lib/documents/documents.ts`, `lib/documents/tree.ts`, `app/api/documents/[id]/route.ts` (new).
- **Reuse**: the write path (`writeDocuments`, its temp-file rename) is untouched; these are new
  readers and mutators over the same array.
- **Done**: deleting a parent removes its whole subtree in one write; a rename that collides in
  the new location is refused (FR-023-02), unlike create, which suffixes.

**A move must not make a cycle.** Nothing in the SRS says so, because nobody writes down that a
document cannot be its own grandparent — but a UI that lets a person drag a parent into its own
child will produce one, and the tree would then be unreachable and unrenderable. `tree.ts` refuses
it, and that is the rule most worth testing here.

**Rename refuses where create suffixes.** FR-023-02 says so explicitly ("오류를 표시하고 재입력"),
and it is the right asymmetry: a suffix on create is the system helping, a silent suffix on rename
would be the system overruling something the person just typed.

### 3. The tree in the UI

- **What**: `document-list.tsx` becomes a tree — nesting, expand/collapse, "새 하위 문서".
- **Files**: `app/(workspace)/document-list.tsx`, `app/(workspace)/page.tsx`.
- **Reuse**: the row, the search box and the columns all stay; what changes is the ordering and
  an indent, computed by `tree.ts` rather than in the component.
- **Done**: a sub-document appears indented under its parent and the parent can be collapsed.

### 4. Realtime (FR-021-06, FR-023-07)

- **What**: every catalogue write broadcasts, and open clients update without a reload.
- **Files**: `lib/documents/documents.ts` or the routes, `server/ws-hub.mts` (no change expected),
  `app/(workspace)/document-list.tsx`.
- **Reuse**: `WsHub.broadcast` is already generic and explicitly not chat-specific (NFR-MAI-001) —
  `chat:message` is one caller, this is the second, which is the reuse that comment predicted.
- **Done**: creating a document in one browser makes it appear in another's tree, no reload.

### 5. The `doc-link` block (SRS §4.1 type 11)

- **What**: a block that links to another document, created from the `/` menu.
- **Files**: `lib/blocks/create.ts`, `app/(workspace)/documents/[id]/doc-link-block.tsx` (new),
  `editor.tsx`, `lib/blocks/slash-menu.ts`.
- **Reuse**: the `link` surface already exists in `BLOCK_KINDS` with no renderer; `DocLinkBlock`
  is already in the type union with a `documentId`.
- **Done**: picking a document from the `/` menu inserts a link that navigates to it.

**A link to a deleted document is a real state**, not an error — FR-023-04 deletes documents and
nothing rewrites the blocks that point at them. It renders as an unavailable link rather than a
crash, the same way a file block whose bytes are gone does.

## Acceptance

- [ ] `pnpm test` — `tree.ts` covers: descendants of a node; a cycle is refused; per-parent name
      collision; ordering with indent depth for the UI.
- [ ] `pnpm test` — delete cascades in one write; rename refuses a collision; create suffixes one.
- [ ] `npx tsc --noEmit`, `pnpm lint`, `pnpm build`, `pnpm verify:docs` clean.
- [ ] Two browsers: create, rename, move and delete each appear in the other without a reload.
- [ ] An existing `documents.json` with no `parentId` loads as a flat root list.

## Cross-cutting

- **SRS**: FR-021-02/03/06, FR-023-01~07, UC-021 E1a, SRS §4.1 type 11.
- **Docs**: `api.md` §1's document rows are target-design today and become shipped; its
  `GET /api/workspace` row describes the tree. `architecture.md` §3(d) lists what `.data/` holds.
  `document-editing.md` §11 describes the link block as designed-not-built.
- **Behaviour change**: name uniqueness moves from global to per-parent (milestone 1).

## Review

**Shipped**: all five milestones. Suite **419 → 456**.

| | |
| --- | --- |
| `lib/documents/tree.ts` | `childrenOf`, `subtreeIds`, `wouldCycle`, `treeRows` — pure, 19 tests |
| `lib/documents/documents.ts` | `parentId`, per-parent uniqueness, rename/move/delete — 18 tests |
| `app/api/documents/[id]/route.ts` | `GET`/`PATCH`/`DELETE`, each broadcasting |
| `app/api/documents/route.ts` | `GET` the catalogue; `POST` takes a `parentId` |
| `document-list.tsx` | a tree with disclosure, "+ 하위", and socket updates |
| `doc-link-block.tsx`, `createDocLink` | SRS type 11, with a picker in the `/` menu |

**Verified against the running app** by `curl`:

| | |
| --- | --- |
| Sub-document creation | `parentId` recorded |
| Same name under two parents (FR-021-03) | both keep `회의록`, no suffix |
| Same name under **one** parent | second becomes `회의록 (2)` |
| Rename onto a sibling's name (FR-023-02) | 400, "같은 위치에 같은 이름의 문서가 있습니다" |
| Move into own subtree | 400, refused |
| Delete a parent of two (FR-023-06) | 3 ids removed in one write, sibling tree untouched |

**Realtime verified with a Node WebSocket client**, which received `document:created`,
`document:changed` and `document:deleted` for the three operations in order.

**Realtime verified in the browser too**, on a second look: creating a document through `fetch`
made the list go 5 → 6 rows with no reload. An earlier round of probes had every socket stuck at
`readyState=0` — chat's shipped one included — and was reported as "this browser cannot do
WebSockets". That was wrong: the probes had all landed around a dev-server restart, and the same
three sockets open in 7–17ms once it is up.

**`/페이지`** was added after the first pass: what was asked for is Notion's gesture — type it and
a new page exists and you are in it — where this had shipped a picker for documents that already
exist. Both are useful, so both are in the menu. Verified in the browser: the URL moved to the new
document, the parent kept a `doc-link` block pointing at it, and the tree drew it indented under
its parent.

**Corrected from the plan**: the plan said the existing E4a test asserts workspace-wide uniqueness
and would have to change. It does not — all three of its documents are created at the root, where
per-parent and global agree, so it passes unchanged. The behaviour change is real; that test just
does not observe it.

**Cut**: nothing.

**Left for another task**: `block-link` (SRS type 12) has no creator, because pointing at one block
inside another document needs a way to choose one, and nothing offers it. Drag-to-move in the tree
UI — `moveDocument` and its cycle rule are built and reachable over `PATCH`, but the only mover
today is the API.
