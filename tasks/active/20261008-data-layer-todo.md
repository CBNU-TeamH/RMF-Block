# The app-side `.data/` layer — shared JSON helpers, soft delete and a host trash

**Created**: 2026-10-08
**Issue**: #114 (WBS 15.0)
**Design**: no new module doc — the changes land in [`architecture.md`](../../docs/design/architecture.md) §3(d), [`chat.md`](../../docs/design/chat.md) "Storage", [`version-history.md`](../../docs/design/version-history.md#deleting-a-document) and [`api.md`](../../docs/design/api.md) §1.

Scope agreed on 2026-10-08: shared read/write helpers, **soft** delete for documents and their
files, a trash on `/admin` where only the host restores, and a **30-day TTL** after which a trash
entry and its files are deleted for good. Workspace metadata is already in place
(`.data/workspace.json`, #170). Not in scope: emptying the trash by hand, the Yorkie document (it
stays, like its revisions), sweeping unattached uploads, content-hash dedup.

## Milestones

### 1. One JSON read/write pair

- **What**: `readJsonFile(path, empty)` (ENOENT → `empty`, any other error throws) and
  `writeJsonFile(path, value)` (mkdir, `.tmp`, rename), both sync, replace the five hand-rolled
  copies. The chat store and the file index go sync as well, so their promise queues are deleted:
  a read-modify-write with no `await` cannot interleave (`chat.md` already argues this).
- **Files**: `lib/json-file.ts` (new), `lib/auth/member-repository.ts`, `lib/chat/chat-repository.ts`,
  `lib/documents/documents.ts`, `lib/files/file-repository.ts`, `lib/workspace-config.ts` (write only —
  its read treats a damaged file as "not set up" and stays as is).
- **Reuse**: the existing write-then-rename and ENOENT logic, moved rather than rewritten. File
  bytes keep their own async write, because they are not read-modify-write.
- **Done**: every existing repository test passes unchanged, including the concurrency cases
  and the "non-ENOENT read throws" cases.

### 2. Soft delete: documents and their files

- **What**: deleting a document moves its subtree to `.data/documents/deleted.json` as one trash
  entry `{ deletedAt, documents }`, instead of dropping the rows. Its files get `deletedAt` and
  disappear from list, find, download and preview. Their bytes stay on disk.
- **Files**: `lib/documents/documents.ts`, `lib/files/{types,file-repository}.ts`,
  `app/api/documents/[id]/route.ts` (DELETE), `app/api/documents/[id]/files/route.ts` (records `documentId`).
- **Reuse**: `subtreeIds`, `uniqueName`, `childrenOf`. `find()` already goes through `list()`, so
  one filter there covers every reader.
- **Done**: after a delete, the tree, page and `/api/documents` behave as today. `deleted.json`
  holds the rows. `/api/files/<id>/preview` returns 404 for that document's files.

### 3. Host trash on `/admin`, with restore

- **What**: a "휴지통" section, with a trash icon, lists the trash entries: the name, "하위 문서 n개"
  and when it was deleted. 복원 brings the whole subtree back, files included, and every open
  tree shows it without a reload. If the original parent is gone, the root goes back at the top
  level. If a sibling now has the same name, the root gets a ` (2)` suffix, as on create. Only the
  host can restore: the route answers 401 to anyone else.
- **Files**: `app/(workspace)/ui.tsx` (`TrashIcon`), `app/admin/page.tsx`, `app/admin/admin-forms.tsx`
  (`TrashList`), `app/api/workspace/trash/[id]/restore/route.ts` (new), `lib/documents/documents.ts`
  (`readTrash`, `restoreDocument`).
- **Reuse**: `isHost()` and the kick route's shape; `useRequest`, `GuestList`'s server-read
  pattern; the `document:created` broadcast the tree already applies.
- **Done**: delete → 복원 on `/admin` → a guest's open tree shows the document again and its image
  previews.

### 4. 30-day TTL purge

- **What**: a trash entry older than 30 days is removed from `deleted.json`, and its files' bytes
  and index rows are removed from `.data/files/`. No timer: the purge runs whenever the trash is
  read (`/admin`) or written (a delete), so it needs no startup wiring. The cost is that it waits
  until one of those happens. `/admin` shows "n일 후 영구 삭제" on each entry.
- **Files**: `lib/documents/documents.ts` (`TRASH_TTL_MS`, purge inside `readTrash`/`deleteDocument`
  returning the purged ids), `lib/files/file-repository.ts` (`purge(documentIds)`), the callers in
  `app/admin/page.tsx` and `app/api/documents/[id]/route.ts`, and `admin-forms.tsx` for the label.
- **Reuse**: `setDeletedAt`'s matching by `documentId`; the existing `unlink` in `save()`'s rollback.
- **Done**: an entry with `deletedAt` older than 30 days disappears from the trash, and its files'
  bytes are gone from disk. The Yorkie document stays.

### 5. Docs

- `architecture.md` §3(d) and §4 still say workspace metadata is "still to come", which is wrong.
  They also need to say that a delete is soft.
- `chat.md` "Storage": every store is sync through `lib/json-file.ts`.
- `version-history.md` "Deleting a document": the constraint is now met, because `deleted.json`
  keeps the ids.
- `api.md` §1: `documentId`/`deletedAt` on files, and the restore endpoint (generated table).

## Test selection

- Vitest (logic / component / server / route):
  - `lib/json-file.test.mts` (new): ENOENT → empty, other errors throw, round trip, no `.tmp` left behind.
  - Existing `lib/chat/chat-repository.test.mts`, `lib/files/file-repository.test.mts`,
    `lib/auth/member-repository.test.mts`, `lib/workspace-config.test.mts` cover milestone 1 unchanged.
  - `lib/documents/documents.test.mts`: the delete writes one trash entry with the subtree; `readTrash`
    lists newest first; `restoreDocument` restores the subtree, puts the root at the top level when the
    parent is gone, suffixes a clashing name, drops the entry, and throws `DocumentNotFoundError` on an unknown id.
  - `lib/documents/documents.test.mts`: an entry past the TTL is purged on read and on delete, and
    its root and descendant ids are returned; one inside the TTL stays.
  - `lib/files/file-repository.test.mts`: `purge` removes bytes and index rows only for matching
    `documentId`s.
  - `lib/files/file-repository.test.mts`: `setDeletedAt` hides a file from `list`/`find` and keeps its
    bytes; clearing it shows the file again; only matching `documentId`s are touched.
  - `app/api/documents/[id]/route.test.ts` (DELETE) marks the document's files; `[id]/files/route.test.ts`
    stores `documentId`.
  - `app/api/workspace/trash/[id]/restore/route.test.ts` (new): 401 for a non-host, 404 for an unknown
    id, 200 with a broadcast per restored row.
  - `app/admin/admin-forms.test.tsx`: `TrashList` renders entries and the empty state, and 복원 posts to the route.
- Browser E2E (`e2e/`): `host.e2e.ts` gets one case. The host deletes a document, restores it from
  `/admin`, and a joined guest's open tree shows it again without a reload. Only a real second
  client proves the live redraw. `tree.e2e.ts` already covers delete reaching the peer, unchanged.
- Container smoke (`.github/workflows/ci.yml`): no change. Startup, auth wiring and networking are
  untouched, and `/admin`'s host gate is already exercised.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] No store under `lib/` hand-rolls ENOENT handling or `.tmp` + rename for JSON any more
      (`workspace-config`'s damaged-file read is the documented exception).
- [ ] A deleted document's row and its files survive in `.data/`, and none of them is reachable by a guest.
- [ ] The host restores from `/admin`, and a guest's tree updates live.
- [ ] A trash entry past 30 days, and its files' bytes, are gone after the next trash read or delete.
- [ ] `pnpm verify:docs` passes, and the endpoint table is regenerated.
- [ ] By hand on the container: delete → 404 preview → restart → still hidden → restore → previews again.

## Cross-cutting

- FR-023-04/06 (delete, subtree cascade). Deletion stays a delete for every guest; only the
  storage underneath changes.
- `version-history.md`'s rule that a delete must keep revision ids is met by `deleted.json`.
- No migration: an existing `deleted.json` is never assumed. Files uploaded before this change
  have no `documentId`, so they stay visible after their document is deleted. Fixing that means
  scanning the Yorkie content, which is not done here.
- New endpoint → `scripts/gen-endpoints.mjs` table in `api.md`.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
