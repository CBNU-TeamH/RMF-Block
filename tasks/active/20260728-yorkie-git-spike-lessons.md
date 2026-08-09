# Spike: Yorkie ↔ server ↔ git round trip — lessons

**Created**: 2026-07-28

## What surprised us

- **Yorkie has real document version management.** We had assumed undo/redo only. v0.7.13 ships
  `createRevision` / `listRevisions` / `getRevision` / `restoreRevision`, and `RevisionSummary.snapshot`
  carries **YSON** (yorkie CHANGELOG #1582, #1584). The SDK even ships a YSON parser —
  `packages/sdk/src/document/yson/`, exported as `yorkie.YSON`. `YSON.parse()` returns a tree whose
  `.root` is exactly the shape `new yorkie.Tree({...})` takes, so YSON ↔ Yorkie round-trips with no
  serializer of our own. This is why YSON, not `.md`, is the restore format.
  - Caveat: with MemDB those revisions are volatile too, so Yorkie's built-in history does **not**
    remove the need for git. It does mean git and Yorkie should not both try to be the history.

- **`@yorkie-js/sdk` runs fine in Node.** It is written and documented for the browser, so we
  budgeted a fallback (Admin API polling). Unnecessary: it guards its browser globals
  (`typeof window !== 'undefined'`, `client.ts:551`) and its only transport dep is
  `@connectrpc/connect-web`, which works on Node 24's fetch. A 20-line script attached and read the
  tree on the first try. **Check this class of assumption with a throwaway script before designing
  around it** — it cost 5 minutes and retired the biggest risk in the plan.

- **The bug that ate the session: a dual-package hazard, invisible on disk.** Realtime sync was
  one-way — every tab pushed, none received. `pnpm why` showed exactly one `prosemirror-model@1.25.11`
  installed, so "multiple versions" looked impossible. It wasn't a version conflict, it was a
  *condition* conflict:

  ```
  prosemirror-model/package.json
    "exports": { "import": "./dist/index.js", "require": "./dist/index.cjs" }
  ```

  One package, one version, **two files**. `@yorkie-js/prosemirror` declares only `main` (its UMD
  build) — no `module`, no `exports` — although it ships an ESM build right next to it. So the
  bundler loaded it as CJS, its `require("prosemirror-model")` took the `.cjs` branch, our page's
  `import` took the `.js` branch, and `Node`/`Fragment` existed twice. Anything crossing the boundary
  failed `instanceof`. Fixed with a Turbopack `resolveAlias` in `next.config.ts` pointing both Yorkie
  packages at their ESM builds. `@yorkie-js/sdk` has the identical shape and was aliased too — it
  hadn't broken yet, but the same trap was armed.

  Generalisable: **"only one copy installed" does not mean "only one copy loaded."** When a library
  reports duplicate-instance symptoms, check the `exports` conditions of the shared dep and how each
  consumer is being loaded, not just the version tree.

- **YSON is a Go-first format, and the JS half is not finished.** We had planned the restore
  around `yorkie.YSON.parse`. The SDK ships no `stringify` at all, and `parse` is a set of
  regexes whose `Tree(...)` pattern bottoms out at three levels of nested braces
  (`yorkie-js-sdk.js:24116`) — a paragraph parses, a bullet list throws. Go has the complete
  implementation (`pkg/document/yson`, `yson.Marshal` / `ParseObject`), which is why the gap is
  invisible from the server side. Reading the yorkie server confirmed where YSON actually sits:
  the operational snapshot it persists is protobuf (`CreateSnapshotInfo`, `server/packs/snapshot.go`),
  and YSON is the format for *revisions*, compaction, `initialRoot`, and the CLI. So YSON is a
  portable interchange format, not Yorkie's storage format — we keep it because
  `yorkie document create --initial-root` can rebuild a document from our file with none of our
  code involved, not because Yorkie stores anything that way.

- **The reference implementation stores no document content of its own.**
  `wafflebase/wafflebase` (the same team's office suite, also Yorkie-backed) has no content
  column anywhere: its Prisma `Document` model is title/type/folder/share-links, with a comment
  saying "content edits never pass through this backend". Yorkie owns the content; the backend
  learns that an edit happened from Yorkie's `DocumentRootChanged` **webhook** and does nothing
  but bump `updatedAt`. That webhook is the alternative to our `doc.subscribe` watcher process
  if we ever want to stop running one. Two other things worth stealing: their tree is
  `<doc><block id=… type=…><inline bold=…>text`, i.e. **blocks carry a stable `id`** — relevant
  to block Lock (`FR-022-06`) — and their one whole-document serializer
  (`scripts/copy-yorkie-documents.ts`) uses `JSON.parse(doc.toJSON())`, not YSON. Note their
  restore assigns plain values straight onto the root, which would *not* rebuild a `Tree` CRDT;
  it works for their sheets because those are JSON. Do not copy that half.

## What we would do differently

- **Verify what the server is actually serving before theorising about the client.** Two full rounds
  of diagnosis were wasted on logging that never reached the browser: the dev server was holding a
  stale Turbopack module, so edits to the page had no effect. Hard reload and an incognito tab did
  nothing, because the staleness was server-side. `curl`-ing the page and grepping for markup we had
  just added would have caught it in seconds, and that check is now the first move whenever a code
  change appears to have no effect. `rm -rf .next` + restart is the fix.

- **Open the library's error channel before writing any of the integration.**
  `YorkieProseMirrorBinding` routes everything, exceptions included, through an optional `onLog`
  callback. We did not pass one, so a hard failure on every remote change produced complete silence —
  the editor simply did nothing. The first version of the page should have wired `onLog`.

- **Don't trust `console.log` under Next 16 dev.** It intercepts console output and forwards it to the
  terminal (`forward-logs-shared.ts`), and not every level round-trips. We rendered the event log into
  the page instead, which is what finally surfaced the real error. For anything realtime, put the
  diagnostics on screen.

- **Fix the packaging bug where it lives, not once per consumer.** The Turbopack `resolveAlias`
  made the browser work, so the dual-package hazard read as solved. It was not — the watcher runs
  on plain Node, which has no bundler config, and the identical
  "multiple versions of prosemirror-model were loaded" appeared on the first
  `buildDocFromYorkieTree` call. `pnpm patch` adding an `exports` map to both `@yorkie-js/*`
  packages fixes every consumer at once, and it took less time than the alias did. The tell that
  we were patching a symptom: the alias's own comment said "drop this once the packages declare
  `exports`" — that sentence was the fix, written down and not acted on.

- Twenty lines of throwaway script settled three questions this session that would each have been
  an hour of debugging inside the watcher: the YSON depth limit, whether the ESM/CJS split reaches
  Node, and whether the markdown path survives a nested list. **The pattern from milestone 1 keeps
  paying — probe the assumption before building on it.**

- The three failures compounded: an invisible error, behind a stale bundle, behind an untrustworthy
  console. Each one alone is minor; stacked, they produced two confidently wrong diagnoses. When
  evidence is *absent* rather than contradictory, suspect the observation path before the system.

## Known bug found on the way (not ours, not fixed)

Remote carets drift. If A's caret sits at the end of a line and B presses Enter and types there,
A's caret renders at B's new position until A moves it. `@yorkie-js/prosemirror` 0.7.13 stores
presence as a CRDT position range — `tree.indexRangeToPosRange(...)`, which is exactly the
insert-safe thing to store — but the receiving side converts it to a plain ProseMirror integer
once, on `presence-changed`, and caches that (`remoteSelections.set(clientID, { from, to })`).
When a remote *content* change arrives, `CursorManager.repositionAll` re-measures pixel
coordinates for the cached integer and never re-derives it, so the caret is redrawn faithfully at
a position the document no longer has. Moving your own caret re-broadcasts presence and fixes it.

The fix is to keep the raw `presence.selection` alongside the resolved positions and re-run
`posRangeToIndexRange` for every remote selection after a downstream sync, before
`repositionAll`. Roughly ten lines, all inside the binding — worth an upstream issue rather than
a patch of ours, since patching library internals has to be redone on every version bump. It does
not touch the persistence path this spike was about.

## Worth extracting

- `AGENTS.md` has no run/verify commands section — no `pnpm dev`, no `docker compose up`. Every
  session rediscovers how to start the thing. Already listed as a gap; this spike is the second time
  it cost us.
- A convention worth writing down: **spike pages render their own event log.** Cheap, and it survives
  whatever the dev server is doing to the console.
- `next.config.ts`'s alias is a workaround for an upstream packaging gap. It carries a comment saying
  to drop it once `@yorkie-js/*` declare `exports`. Worth an upstream issue.
- `capde-demo/prototype` (the team's working CodeMirror demo) sidesteps all the React-lifecycle
  problems by using `@yorkie-js/react`'s `YorkieProvider`/`DocumentProvider` instead of hand-rolling
  `useEffect`. Its `EditorView.tsx` comments document a double-attach bug they hit. If we keep
  hand-managing the client, expect to re-derive what that package already solved.
