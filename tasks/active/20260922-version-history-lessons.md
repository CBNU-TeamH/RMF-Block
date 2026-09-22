# Document version history on Yorkie's Revision API — lessons

**Created**: 2026-09-22

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## Phase 0 measurements (2026-09-22, Yorkie 0.7.13 + MongoDB, throwaway projects)

Throwaway probe scripts, nothing committed, the default project read but never written.

| # | Question | Answer |
| --- | --- | --- |
| (a) | Does `YSON.parse` survive our document shape? | **Mostly.** 20 blocks, bullet lists, CJK/emoji, double quotes, `[1]`, a markdown link, multi-node `Text`, nested attr arrays, even a literal `Text([{}])` inside the text — all parse. It **throws on an unbalanced `[` or `]`** in user text (`Failed to parse YSON`), because the regexes have no idea when they are inside a JSON string. |
| (b) | Does the restoring client's own view update? | **No.** The restoring client receives exactly one event: `type: "snapshot"`, `source: "remote"`, **zero operations**. `use-block-document.ts:125` returns early for anything that is not `remote-change` or `local-change`+`undoredo`, so nothing recomputes — and `touchesBlockList` never gets a path to judge. |
| (c) | Exact webhook spelling of the revision methods? | `CreateRevision`, `GetRevision`, `ListRevisions`, `RestoreRevision` — all four accepted verbatim by `UpdateProject`. Oracle proven: `CreateRevisions`, `Revision`, `RestoreRevisions` and `PushPullChanges` are all rejected. |
| (d) | What label does an automatic revision carry? | `label = "snapshot-N"`, `description = "Auto created revision of snapshot #N"`. Automatic revisions **do** fire (27 of them from 25 synced edits at interval/threshold 1). The default project reads `autoRevisionEnabled: true`, `snapshotInterval`/`snapshotThreshold` 500. |
| (e) | *(not planned)* Does restore work on our schema? | **No — and this is blocking.** See below. |

### (e) `restoreRevision` cannot restore our block schema

A property named **`type` on an object inside an array** makes `restoreRevision` fail with
`[invalid_argument] unsupported element`. Yorkie's server-side YSON parser reads that key as a CRDT
element-type discriminator. Deterministic — 11/11 across four mutation patterns, then isolated:

| Snapshot | Restore |
| --- | --- |
| `{"a":[{"c":{"t":Text([{"val":"hi"}])},"id":"b1"}]}` | OK |
| `{"a":[{"c":{"t":Text([{"val":"hi"}])},"kind":"text"}]}` | OK |
| `{"a":[{"c":{"t":Text([{"val":"hi"}])},"type":"text"}]}` | **FAIL: unsupported element** |
| `{"a":[{"plain":"hi","type":"text"}]}` — no `Text` anywhere | **FAIL: unsupported element** |
| `{"a":[{"plain":"hi","type":"Text"}]}` | **FAIL: parse text: invalid YSON** |
| `{"type":"text","x":Int(1)}` — `type` at the root | OK (only inside an array) |

The last two rows are the proof of mechanism: feed it `type: "Text"` and the server stops saying
"unsupported" and starts trying to **parse the object as a Text element**. It is not about `Text`,
not about nesting depth, and not about how many `doc.update()` calls built the document — a plain
`{plain, type}` pair inside an array is enough.

`StoredBlock = { id; type; content? }` inside `root.blocks` (`lib/blocks/document.ts:18-42`) walks
straight into it. **Reproduced identically on Yorkie 0.7.17**, so upgrading the pin is not the fix;
renaming the key is (`kind` verified working).

### Ordering constraint found while probing

`createRevision` snapshots **the server's** view of the document, not the local one. Called right
after `doc.update()` without an intervening `client.sync()`, it records an empty snapshot (`{}`) and
`listRevisions` reports it with no complaint. Anything that creates a revision — above all the
"before restore" safety revision — has to sync first or it captures nothing.

## What surprised us

- **A four-day design detour came from one misread word.** A comment on #23 said version history
  "is not using yorkie, it just snapshot", and the reference project (wafflebase) describes its own
  history as "snapshot-based". Both are true and neither means what we took them to mean: a Yorkie
  Revision *is* a snapshot plus version metadata, and wafflebase uses the Revision API. "Snapshot or
  revision API" was never a choice. The signal that the premise was wrong was that the lazy path
  kept getting harder — host client → dedicated node → server watching every document → on-demand
  attach with a dirty signal. Four escalations without ever reaching something simple is the tell.

- **Adding the revision methods to `GUARDED_METHODS` alone would have changed nothing.**
  `app/api/internal/yorkie/auth/route.ts` reads `body.token` and never looks at `body.method`, so it
  is an authentication gate, not an authorisation one. Registering the four names would have let
  every authenticated guest restore — while looking like the hole had been closed. Half of this fix
  is worse than none of it.

- **The 2026-07-28 spike's YSON verdict did not transfer.** "A paragraph parses, a bullet list
  throws" was measured against the `Tree(...)` pattern's three-level brace ceiling, during a spike
  that was exploring a Tree-based model. This repo's root holds no Tree at all (blocks are a Yorkie
  Array — ADR-007), so that ceiling is not on our path. Re-reading the installed 0.7.13 rather than
  trusting the note changed the risk assessment: `Text(...)` is bracket-bounded and our text sits one
  bracket deep, and the real hazard is that the regex has no idea when it is inside a JSON string.
  Generalisable: **a measured limitation is measured against a particular shape.** Check whether your
  shape is that shape before inheriting the conclusion.

## What we would do differently

- ...

## Worth extracting

- **"Who calls it" is not the same question as "who is allowed to".** Routing the revision calls
  through the App/WS server would have looked like a permission boundary and been none: the guest's
  browser holds an activated Yorkie client and can call `client.restoreRevision(doc, id)` directly.
  Whenever a client already holds a credential for a backend, an app-side endpoint in front of that
  backend is a convenience, not a gate. Candidate line for `docs/conventions.md`.
