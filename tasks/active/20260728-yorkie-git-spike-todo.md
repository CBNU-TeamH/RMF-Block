# Spike: Yorkie ↔ server ↔ git round trip

**Created**: 2026-07-28
**Issue**: —
**Design**: none. This is a spike whose output *is* the design input — it decides what the
server commits to git. The ADR (`docs/adr/001-realtime-sync.md`, `AGENTS.md` §7) gets written
once this answers the question.

## Goal

`AGENTS.md` §1 fixes the architecture — realtime on self-hosted Yorkie, local Git off the
realtime path as the persistence/history layer — but nothing has verified it. This spike proves
the loop end to end and decides the stored format.

**Decisions carried in**: Yorkie only, no MongoDB (MemDB) · commit YSON **and** `.md`, YSON is
the source of truth · the watcher runs as its own process.

Because MongoDB is out, Yorkie is volatile and **git is the only durable store**. That promotes
restore from optional to required (`SRS-ko.md:472`, `NFR-REL-002`, `FR-010-05`) and makes the
round trip — not diff readability — the criterion that picks the format.

## Milestones

### 1. Yorkie up, server can read it — ✅ done

- **What**: self-hosted Yorkie in Docker; prove a Node process can attach and read the CRDT doc.
- **Files**: `docker-compose.yml`
- **Reuse**: `yorkieteam/yorkie:0.7.13`, `command: ["server"]` — form taken from yorkie's own
  `build/docker/docker-compose-full.yml`. No `--mongo-connection-uri` → MemDB.
- **Done**: ✅ a throwaway Node script activated a client, attached, and printed
  `tree.toXML()`. `@yorkie-js/sdk` runs in Node — this was the spike's biggest unknown.
  Node 24 runs `.ts` directly, so no `tsx`.

### 2. ProseMirror client page — ✅ done

- **What**: the Yorkie ProseMirror example as a Next page, two browsers editing live.
- **Files**: `lib/pm-schema.ts`, `app/spike/prosemirror/page.tsx`, `next.config.ts`
- **Reuse**: `@yorkie-js/prosemirror`'s `YorkieProseMirrorBinding` — mirrors upstream
  `examples/vanilla-prosemirror/src/main.ts`.
- **Done**: ✅ two tabs sync live, remote cursors render, no `binding[error]`.
  Required a Turbopack alias — see the lessons doc, this cost most of the session.

### 3. `server/watcher.mts` — 🟡 written, needs a browser to confirm

- **What**: a Node Yorkie client that restores from git on start, then commits on a debounce.
- **Files**: `server/watcher.mts`, `package.json` (`spike:watch`, `pnpm.patchedDependencies`),
  `.gitignore` (`/.data`), `tsconfig.json` (`allowImportingTsExtensions`),
  `patches/@yorkie-js__{sdk,prosemirror}@0.7.13.patch`
- **Reuse**: `buildDocFromYorkieTree` (`@yorkie-js/prosemirror`) — one call covering
  `yorkieToJSON` + `Node.fromJSON` — then `defaultMarkdownSerializer`
  (`prosemirror-markdown`), with `lib/pm-schema.ts` as the schema.
  `execFile('git', …)` from `node:child_process` — no git library.
- **Two decisions the plan above did not survive**:
  1. **`yorkie.YSON.parse` is not usable.** The SDK has no `stringify`, and `parse`'s
     `Tree(...)` regex matches only three levels of nested braces
     (`yorkie-js-sdk.js:24116`), so a document with a bullet list throws. The file stays
     YSON — `{"tree":Tree({…})}`, which the yorkie CLI's `--initial-root` accepts and Go
     parses fully — but the watcher slices the wrapper off itself. Marked `ponytail:`.
  2. **The dual-package hazard reaches Node too.** The same
     "multiple versions of prosemirror-model were loaded" that ate the milestone-2 session
     fires in the watcher, where `next.config.ts`'s Turbopack alias cannot help. Fixed at the
     root with `pnpm patch` adding `exports` to both `@yorkie-js/*` packages, which is what
     the alias comment always said to wait for. **The alias in `next.config.ts` is now
     redundant but was left in place** — removing it needs the two-tab browser check, so it
     belongs to whoever runs milestone 4.
- **Shape**:
  1. ensure `.data/workspace/` exists, `git init` if absent
  2. **restore before attach**: if `<docKey>.yson` exists → `YSON.parse` → `.tree.root` →
     `new yorkie.Tree(root)` → `client.attach(doc, { initialRoot: { tree } })`.
     `initialRoot` only fills fields the doc lacks (`client.ts:770`), so it no-ops when Yorkie
     is still live. Already proven by the milestone-1 smoke test, which attached exactly this way.
  3. `doc.subscribe` → debounced flush
  4. flush: serialize YSON, render `.md`, **skip if neither changed**, `git add` + `git commit`,
     log ms for each of the three stages
- **Done**: typing in the browser produces a commit in `.data/workspace/` holding both files.
- **Note**: `.mts`, not `.ts` — it pins the file to ESM without putting `"type": "module"` in
  `package.json` and flipping the whole Next app.
- **Verified**: ✅ end to end against a running Yorkie, with a Node client standing in for the
  browser (`doc.update` + `pmToYorkie`, the same tree shape the binding writes). Seed and edit
  each produced one commit carrying both files; the `.md` diff is a one-line prose diff.
  Still worth doing in the browser once, to confirm the binding and the watcher agree.

### 4. Round trip + findings — ✅ done

- **What**: prove git alone can rebuild the document, and record the measurements.
- **Done**: ✅ `docker compose restart yorkie` wiped MemDB; the restarted watcher logged
  `restored verify-m3.yson (463 bytes)` and a fresh client read the document back intact —
  `<doc><heading level="2">Spike</heading><paragraph><span>EDITED hello </span><strong>world</strong>…`
  — bold mark and nested list included, which is exactly what `YSON.parse` would have thrown on.
  Git alone rebuilt the document.
- **Per-flush timings** (WSL2, workspace on `/mnt/c`):

  | stage | ms |
  | --- | --- |
  | YSON serialize | 0.0 – 0.3 |
  | markdown render | 0.7 – 2.2 |
  | `git add` + `commit` | 234 – 258 |

  Git is ~99% of the flush and the other two are free. That is the whole argument for keeping
  git off the realtime path (`SRS-ko.md` §2.3.2) stated in numbers. Caveat before anyone reuses
  these: `/mnt/c` is the Windows filesystem through WSL2's 9p layer, where git is roughly an
  order of magnitude slower than on ext4 — treat 250ms as a pessimistic bound, and re-measure
  on the deployment target before it becomes a load-test baseline.
- **Browser check**: ✅ two tabs editing the live page produced four commits
  (`git 416–617ms` — higher than the headless numbers because `next dev` shares the disk), and
  the resulting `.md` reads as plain prose. Done with the `next.config.ts` alias removed, so the
  patches are confirmed to cover the browser too.

## Acceptance

- [x] `docker compose up -d` runs Yorkie alone on MemDB
- [x] two browser tabs edit the same doc in realtime, with cursors
- [x] a Node process attaches to the same doc and reads the tree
- [x] editing produces a commit in `.data/workspace/` with `<docKey>.yson` + `<docKey>.md`
- [x] no edit for a debounce window → **no** new commit — and a stronger case holds: typing a
      character and deleting it inside one debounce window logs `no change — skipped` and leaves
      the commit count where it was
- [x] Yorkie wiped → watcher restarted → document restored from git
- [x] per-flush ms for YSON / md-render / git-commit recorded
- [x] `pnpm lint` and `pnpm build` pass (`AGENTS.md` §6)

## Cross-cutting

- Satisfies the persistence half of `SRS-ko.md` §2.3.2; feeds `docs/adr/001-realtime-sync.md`.
- `next.config.ts`'s Turbopack alias is **gone** — `patches/` now gives both `@yorkie-js/*`
  packages the `exports` map they are missing, which covers the bundler and plain Node at once.
  Verified in two browser tabs after removal. The patches carry the same "drop once upstream
  declares `exports`" note the alias did.
- Remote carets drift after a peer inserts a line, until you move your own — an upstream bug in
  `@yorkie-js/prosemirror`, diagnosed in the lessons doc. Unrelated to persistence; left alone.
- Adds two top-level dirs, `lib/` and (next) `server/`. `README.md`'s Structure table needs both.
- Does **not** touch `AGENTS.md`. Its missing "run/verify commands" section is a real gap but a
  separate task.

## Picking this up in a new session

```bash
docker compose up -d                 # Yorkie on :8080 (MemDB — restarting wipes it)
pnpm dev                             # Next on :3000
# http://localhost:3000/spike/prosemirror?key=<anything>  — two tabs
pnpm spike:watch <same key>          # watcher; commits into .data/workspace/
```

The page renders its own event log (black panel under the editor). Trust that, not the browser
console — Next dev intercepts `console.*` and forwards it to the terminal.

Then start milestone 3.

## Review

The loop holds. Yorkie carries the realtime edits, a Node client off the realtime path writes
YSON + markdown into a git repository on a 2s debounce, and wiping Yorkie loses nothing — the
watcher rebuilds the document from the committed YSON. That is the answer the ADR needs.

What the ADR should carry over:

- **Stored format**: YSON (`{"tree":Tree({…})}`) as the source of truth, markdown alongside it
  for humans and for diffs. Chosen because `yorkie document create --initial-root` can rebuild a
  document from the file with none of our code in the loop — **not** because Yorkie stores
  anything this way. Yorkie's own durable snapshot is protobuf; YSON is its interchange format.
- **The JS SDK cannot read its own format.** No `stringify`, and `parse` gives up at three levels
  of brace nesting. We write the wrapper and slice it off ourselves, ~2 lines each way. If a
  second CRDT type ever joins the tree in the document root, that shortcut has to become a real
  parser — or upstream has to fix theirs.
- **Cost**: git is ~250ms per flush against ~2ms for everything else, which is the measured
  reason git stays off the realtime path rather than an assumed one.
- **Not decided here**: the debounce window is 2s because it is a round number, and nothing in
  `SRS-ko.md` pins it. Block Lock, the disconnect grace period, and the load-test baseline
  (`AGENTS.md` §7) are all still open and none of them were touched by this spike.
