# UC-023: rename, move and delete a document, from the UI

**Created**: 2026-09-14
**Issue**: none — a gap found reading `ROADMAP.md` Phase 2 against the code
**Design**: [`docs/design/api.md`](../../../../docs/design/api.md), "The document endpoints" — the
server half is already designed and built; this task is the client half only.

FR-023-01~07 have a complete server and no UI. `app/api/documents/[id]/route.ts` implements
`PATCH` (rename, move) and `DELETE` (with FR-023-06's subtree cascade), validates name clashes
and cycles, and broadcasts `document:changed` / `document:deleted` for FR-023-07.
`document-list.tsx` calls `fetch` in exactly one place — `POST /api/documents`, to create. So
today the workspace can make documents and can never rename or remove one.

That is also why this is the next thing rather than a Phase 3 or 4 feature: it is the largest
behaviour gap per line of new code in the repo, and the risk is confined to one client component.

## Milestones

### 1. The three operations, from the row

- **What**: each row carries a ⋯ overflow menu holding 새 하위 문서 / 이름 변경 / 이동 / 삭제,
  and each opens a modal that performs the write.
- **Files**: `app/(workspace)/document-actions.tsx` (new), `app/(workspace)/document-row-menu.tsx`
  (new), `app/(workspace)/document-list.tsx`.
- **Reuse**: the route handlers and `lib/documents/documents.ts` are untouched — every rule
  (FR-023-02's clash, FR-023-06's cascade, `wouldCycle`) already lives there and is already
  tested. `subtreeIds` is reused to decide which parents a move may offer. The `<dialog>` +
  `showModal()` shape is `join-form.tsx`'s and this file's own, not a new pattern.
- **Done**: a document can be renamed, moved and deleted, and a second browser sees each change
  without reloading.

### 2. Tests

- **What**: component tests at the layer the behaviour lives in (`docs/testing.md`).
- **Files**: `app/(workspace)/document-actions.test.tsx` (new),
  `app/(workspace)/document-row-menu.test.tsx` (new).
- **Done**: `pnpm test` green, and each test checked to fail against the behaviour it pins.

## Acceptance

- [x] A document can be renamed (FR-023-01), and a clashing name shows the server's message
      rather than a client-side guess (FR-023-02)
- [x] A document can be moved to another document or to the root (FR-023-03)
- [x] The move list never offers the document itself or anything under it — `wouldCycle`'s rule,
      applied before the request rather than after it (test, checked to fail without the filter)
- [x] Delete asks first (FR-023-05), and says how many documents go with it (FR-023-06)
- [ ] A second browser sees a rename, a move and a delete without reloading (FR-023-07) — the
      broadcasts are the server's and unchanged, and `document-list.tsx` already handled both
      events for create; **not re-verified with two browsers in this task**
- [x] Row actions are reachable by keyboard: the ⋯ opens on Enter, focus lands on the first item,
      Escape closes it and hands focus back
- [x] The control never overlaps a data column — measured in the browser, ⋯ starts at x=1503 with
      CREATED ending at x=1494
- [x] `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm comments`, `pnpm verify:docs`

## Cross-cutting

FR-023-01~07, `ROADMAP.md` Phase 2. No server, schema or protocol change — the endpoints and
their broadcasts already exist and are unmodified by this task.

## Review

Shipped as planned: one new client component, one changed one, nothing touched on the server.

Verified by hand against the running app, not only by test: renamed a document (row and its
`updatedAt` both updated), moved it from under a parent to the root (the tree re-drew at the new
depth), and deleted a throwaway document (12 → 13 → 12 rows). The delete confirmation was also
opened on a parent with three descendants to read its warning, then cancelled — the count was
right and cancelling wrote nothing.

Not re-verified: FR-023-07 across two browsers. The broadcasts are the server's, unchanged by
this task, and the client already consumed both events for create — but "already consumed" is an
argument, not an observation, so it stays unticked above.
