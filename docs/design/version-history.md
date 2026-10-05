# Version History

- **Status**: Built ([#117](https://github.com/CBNU-TeamH/RMF-Block/pull/117)). The mechanism below is measured, not assumed — see
  [Verification](#verification). Requirements: UC-090 and FR-090-01..13 in `docs/SRS-ko.md`,
  added with team agreement (`AGENTS.md` §5), closing the gap
  [issue #23](https://github.com/CBNU-TeamH/RMF-Block/issues/23) recorded.
- **Owns**: `lib/blocks/revision-snapshot.ts`, `lib/documents/revisions.ts`,
  `app/(workspace)/documents/[id]/version-history.tsx`. Each is a file-level claim inside a
  directory [`document-editing.md`](document-editing.md) owns, so the more specific claim wins —
  the same shape [`presence-and-focus.md`](presence-and-focus.md) already uses.
- **Related**: [`docs/design/architecture.md`](architecture.md) §3(c);
  [`docs/adr/002-persistence-on-yorkie-mongo.md`](../adr/002-persistence-on-yorkie-mongo.md);
  [`docs/SRS-ko.md`](../SRS-ko.md) UC-090, §3.3.14, SOIR003, §2.3.2

## Scope

Listing a document's past versions, previewing one read-only, naming one, and restoring the
document to one. Undo/redo is a different mechanism entirely and lives in
[`document-editing.md`](document-editing.md) — it tracks local changes in memory, not revisions.

## What Yorkie provides, and what the app adds

Version history is built on Yorkie's revision API (ADR-002). Three of its four calls are used
as-is from the browser, where the `Client` and the attached `Document` already live
(`presence-provider.tsx` holds the client; `use-block-document.ts` holds the document).

| Call | Used | Notes |
| --- | --- | --- |
| automatic revisions | yes, with no app code | the project runs `autoRevisionEnabled` with `snapshotInterval`/`snapshotThreshold` at 500, so Yorkie records one every time it snapshots |
| `listRevisions` | yes | metadata only; the `snapshot` field comes back empty, which is what makes the sidebar cheap |
| `getRevision` | yes | returns the snapshot as YSON |
| `createRevision` | yes | named revisions, and the before-restore revision |
| `restoreRevision` | **no** | see below |

The app adds four things: a YSON reader, restore, revision classification, and the before-restore
safety revision.

<!-- declare: yorkie-revisions
called-only-from: createRevision|listRevisions|getRevision in app/(workspace)/**   # the browser's own Client; no server-side call
never-called: restoreRevision                                         # the app restores by rewriting blocks (below)
const: lib/yorkie-admin.ts GUARDED_METHODS includes ["CreateRevision", "GetRevision", "ListRevisions", "RestoreRevision"]
-->

## Why the app restores instead of calling `restoreRevision`

`restoreRevision` has the server re-parse the snapshot and rebuild the document. On the pinned
Yorkie (0.7.23) that re-parse is unusable for this schema, for two reasons: the `type`-key
discriminator below crashes it, and `doc.history.undo()` after a `restoreRevision` throws
outright. The version-by-version measurements are in
`tasks/archive/2026/09/20260922-yorkie-0723-lessons.md` and
`tasks/archive/2026/09/20260922-version-history-lessons.md`.

**A `type` key inside an array element is read as a CRDT element discriminator.** Our stored block
is `{ id, type, content }` and the blocks live in an array, so every document in this project hits
it:

| Snapshot | `restoreRevision` |
| --- | --- |
| `{"a":[{"c":{"t":Text([{"val":"hi"}])},"id":"b1"}]}` | works |
| `{"a":[{"c":{"t":Text([{"val":"hi"}])},"kind":"text"}]}` | works |
| `{"a":[{"c":{"t":Text([{"val":"hi"}])},"type":"text"}]}` | `unsupported element` |
| `{"a":[{"plain":"hi","type":"text"}]}` — no `Text` anywhere | `unsupported element` |
| `{"a":[{"plain":"hi","type":"Text"}]}` | `parse text: invalid YSON` |
| `{"type":"text","x":Int(1)}` — `type` at the root | works |

The last two rows are the mechanism: given `type: "Text"` the server stops calling it unsupported
and starts trying to parse the object *as* a Text. `type` is the only key that does this — `id`,
`content`, `text`, `level`, `style`, `depth`, `checked`, `fileId`, `fileName`, `fileType`, `size`,
`documentId`, `blockId`, `val`, `nodes`, `attrs`, `children`, `value`, `Text`, `Tree` and `Counter`
all restore cleanly.

Renaming the stored discriminator to `kind` would avoid the crash but not the undo failure. So the app
does the restore itself: `getRevision` returns a correct snapshot, `revision-snapshot.ts` reads it,
and the blocks are written back with two `doc.update()` calls — the array first with empty
`yorkie.Text` values (`toStoredBlock` already does exactly this), then each text filled, because a
`Text` cannot be edited before it is in the tree.

Four consequences, all of them simplifications:

- The stored schema keeps `type`. No rename, no migration, no ADR-007 change.
- A restore is an ordinary local edit, and `replaceBlocks` re-reads the blocks and republishes them
  itself (`setBlocks`, plus the `restoreCount` bump below), because a local change never comes back
  through `doc.subscribe`. Calling `restoreRevision` would not work either: it delivers a single
  `snapshot` event carrying **no operations**, and `use-block-document.ts` acts only on
  `remote-change` and undo/redo, so nothing would re-render.
- Peers converge through the normal remote-change path.
- `Ctrl+Z` after a restore undoes the restore, which is the behaviour a reader expects. With the
  server-side call the local undo stack would still hold reverse operations recorded against the
  pre-restore document.

A restore also remounts every block row. A restored block usually keeps its id, and the editor keys
its rows by id — so React would reuse the mounted `TextBlockView`, whose textarea is uncontrolled
(`defaultValue`) and whose `lastSyncedRef` diff baseline both still hold the pre-restore text. The row
would show the old text, and the next keystroke would diff against it and write a patch at offsets
the restored text does not have. `replaceBlocks` bumps `restoreCount`, which is part of every row's
key — the same move `page.tsx` makes with `key={document.id}` when a different document replaces the
current one, since a restore replaces the content just as wholesale.

Restore runs in a fixed order: `getRevision` and parse the target, `client.sync()`,
`createRevision` (before-restore), then `replaceBlocks`. The fetch comes first and is not
overlapped with the rest, because no revision can be deleted: a before-restore revision left by a
restore that then failed to fetch or parse would be permanent litter.

An empty snapshot cannot be restored (the button is disabled). Blocks with a missing, empty, non-string or
duplicate id are dropped when the snapshot is read, so a restore can write fewer blocks than the raw
snapshot holds.

What the app gives up is atomicity: two people restoring at once merge as CRDT edits rather than
one server-side replace. For an eight-person LAN workspace that is acceptable, and the
before-restore revision makes either outcome reversible.

## `createRevision` snapshots the server's view

A revision records what Yorkie knows, not what the browser holds. Called straight after
`doc.update()` with no `client.sync()` in between it stores `{}`, and `listRevisions` reports that
revision without complaint. **Every `createRevision` call must sync first** — above all the
before-restore one, which is worthless if it captures an empty document.

## Kinds

Told apart by label, because the label is the only field the app controls and Yorkie has no way to
tag a revision otherwise.

| Kind | Label | Shown as |
| --- | --- | --- |
| automatic | `snapshot-N`, written by Yorkie | 자동 저장 |
| before-restore | `before-restore:<revision id>`, written by the app | title 복원 직전 상태, tag 복원 전 |
| named | whatever the user typed | title the label, tag 수동 저장 |

Stored labels stay English and machine-readable: there is no API for editing or deleting a
revision, so a label is permanent and the Korean a reader sees is chosen at render time.

An unrecognised label reads as `named` rather than being dropped — a revision someone made by hand
is the one kind that must not vanish from the list.

The two reserved shapes are refused as manual save names (`reservedLabelReason`). Kind is read from
the label alone, so a manual save called `snapshot-7` would come back as an automatic one — hidden
behind the default filter, titled 자동 저장, indistinguishable from Yorkie's own. It is refused at
the point of entry rather than mangled into a namespace, because the stored label is what the reader
sees and there is no API to correct it later.

## Retention is paging, not truncation

There is no delete API, so nothing can be pruned. That turns out not to matter, because nothing is
unreachable either. Measured paging contract for `listRevisions`:

- default order is newest first; `isForward: true` reverses it
- `offset` pages with no gaps and no overlap
- a page shorter than `pageSize` means the oldest revision has been reached
- past the end it returns nothing

So the sidebar pages on demand and says when it has reached the first version. An artificial
ceiling was considered and rejected: it would hide history that is still there, silently.

The pile does grow — one full snapshot per 500 changes, in Yorkie's MongoDB rather than the host's
`.data/`. Squashing it the way `git rebase` would is not possible without a delete API. The levers
that do exist are the project's `snapshotInterval`/`snapshotThreshold`, and filtering automatic
revisions out of the default view.

## Deleting a document

**Measured, not assumed** (against `@yorkie-js/sdk@0.7.13`, not re-measured on the current `0.7.23` pin, on the Mongo-backed Yorkie in `docker-compose.yml`): a revision outlives the document it belongs to, but only by id. After `client.remove(doc)`, `getRevision(doc, revisionId)` still returns the full snapshot while `listRevisions` on a fresh `Document` under the same key returns empty. **Anything that deletes a document therefore has to keep the revision ids somewhere, or the history becomes unreachable rather than merely hidden** — a constraint for whoever builds FR-023's delete. UC-023's 비고 records the same, added under the team agreement `docs/SRS-ko.md` requires (`AGENTS.md` §5) — [issue #28](https://github.com/CBNU-TeamH/RMF-Block/issues/28).

## Who may restore

Everyone, for two reasons.

First, a guest can already replace every block by hand (`FR-022-06`, `SIR003` — occupancy does not
block editing), so restoring grants no capability a guest lacks. Gating it behind the host would
only concentrate a single, instantaneous, easy-to-misclick action behind one person rather than
eight.

Second, **the safety net this feature builds makes a wrong restore self-healing, more precisely
than a wrong manual edit is.** `restore()` always takes a `before-restore:<targetId>` revision
first, so undoing a bad restore is exactly one more restore away, to a revision that exists for
exactly this purpose. A manual editing mistake has no equivalent precision — recovering from it
means hunting through whichever automatic snapshot happens to predate it.

What replaces the restriction is attribution, not access control: `createNamed` and `restore` both
pass the acting browser's nickname as the revision's `description` (`RevisionSummary.description`
has no dedicated author field, so this is the whole mechanism). The sidebar shows it next to every
named or before-restore entry — automatic ones carry Yorkie's own description instead, which names
no one. "Who did this" is answered by reading the revision, not by narrowing who could have.

The auth webhook guards all four revision methods (list in [`api.md`](api.md) §2, "RPC —
rmf-block-server ↔ Yorkie"). It checks only that the session is live, which is what keeps a
revoked session from reading or writing history — the same rule for all four methods, matching the
decision above that none of them needs a narrower gate.

## Verification

The isolating cases for the `restoreRevision` defects, the paging contract and the
automatic-revision label are in `tasks/archive/2026/09/20260922-version-history-lessons.md`.

`lib/blocks/revision-snapshot.test.mts` asserts the reader against a snapshot captured from a
running server rather than a hand-written one, because the characters the reader exists for — a
paren, an unbalanced bracket, an escaped quote — are the ones a hand-written sample would leave
out.
