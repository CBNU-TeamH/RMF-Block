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

### Paging, measured after the fact

`listRevisions` returns newest first, `offset` pages with no gaps or overlap, a page shorter than
`pageSize` means the oldest revision is on screen, and past the end it returns nothing. That killed
a constant this task had already written: a `MAX_DISPLAYED_REVISIONS` cap would have silently
hidden history that is perfectly reachable. **A retention policy was invented before checking
whether anything forced one.**

### Container check of the guard

With all nine methods registered on the default project: a token the app issued gets
`createRevision`, `listRevisions` and `getRevision`; a token it never issued is refused
`unauthenticated`. Both directions, in the container, per `AGENTS.md` §2.

### The comment-budget ratchet earned its place on the first real case

This branch carries the staged 30%-plus-ratchet change, and it caught a genuine regression rather
than noise: `use-block-document.ts` was already at **31.0%** on the merge base, this task pushed it
to **32.9%** with one twelve-line comment block, and `--strict` failed with exit 1. Shortening the
block to five lines and moving the argument into `docs/design/version-history.md` brought it to
**30.5%**, where the ratchet passes it as inherited. That is the whole intended loop — flag what
this change made worse, stay silent about what it did not — and it ran end to end before the
promotion date rather than after it.

Worth noting for whoever reads the numbers: the absolute threshold alone would have failed this
file either way, since 30.5% is still over 30%. The ratchet is what makes the difference between a
signal and a blocked PR.

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

### The `)`→`}` corruption is not Array-specific — measured against `yorkie.Tree` too

Prompted by "wafflebase manages content as a Tree, would it dodge this bug?" Built the same
wafflebase-shaped tree (`<doc><block><text value=...>`) and ran it through `createRevision` →
mutate → `restoreRevision`:

| Tree text value | after `restoreRevision` |
| --- | --- |
| `"report (final).pdf"` | `"report (final}.pdf"` |
| `"a ) b"` | `"a } b"` |
| `"close ] alone"` | `"close ] alone"` (unaffected — that one was always a client-side `YSON.parse` limitation, not a server restore bug) |

So switching block storage from Array to Tree would have fixed the `type`-key discriminator crash
(Tree nodes are supposed to have `type`, so there is no ambiguity for the parser) but **not** the
silent paren corruption, which is a lower-level bug in the server's wrapper-closing-paren scan and
hits any string regardless of container shape. It would also reopen what ADR-007 measured and
rejected Tree for independently: re-parenting a `yorkie.Text` into a new Tree parent silently empties
it, no exception. Net: Tree trades one loud failure (bug 1) for a live-editing data-loss bug ADR-007
already found, while keeping the quiet one (bug 2). Not adopted.

### Restore was host-only, then wasn't

Shipped it host-only first, reasoning that a single instantaneous whole-document rewrite deserved a
narrower blast radius than eight people each holding the button. That reasoning didn't survive being
challenged: the feature's own before-restore revision makes a wrong restore *more* precisely
recoverable than a wrong manual edit already is, so restricting access was guarding against a
mistake the feature had already made cheap to undo. Replaced the restriction with attribution —
`createRevision`'s `description` carries the acting browser's nickname — which answers "who did
this" without deciding who is allowed to. `docs/design/version-history.md`'s "Who may restore"
carries the fuller argument.

Cost of the reversal: the client-side `isHost` signal (`PresenceState.isHost`, threaded from
`layout.tsx`'s existing `role`-cookie check) had exactly one consumer, this button. Removed it
rather than leave it unused — nothing else in the codebase reads presence-context `isHost` today.

## What we would do differently

- ...

## Worth extracting

- **"Who calls it" is not the same question as "who is allowed to".** Routing the revision calls
  through the App/WS server would have looked like a permission boundary and been none: the guest's
  browser holds an activated Yorkie client and can call `client.restoreRevision(doc, id)` directly.
  Whenever a client already holds a credential for a backend, an app-side endpoint in front of that
  backend is a convenience, not a gate. Candidate line for `docs/conventions.md`.
