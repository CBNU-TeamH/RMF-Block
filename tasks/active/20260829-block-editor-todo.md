# Open a document and edit it together

**Created**: 2026-08-29
**Issue**: closes [#44](https://github.com/CBNU-TeamH/RMF-Block/issues/44) and
[#45](https://github.com/CBNU-TeamH/RMF-Block/issues/45); leaves #46, #6, #39 and #42 open
**Design**: [`docs/design/document-editing.md`](../../docs/design/document-editing.md). The
field-level schema for all twelve block types is settled there (Status: Agreed). **The editing
surface is not, and this task adds it to that same file** as an "Editing surface" section —
`architecture.md` §5 puts a module's detailed design in `docs/design/<module>.md`, and for the
Document Editing module that file is this one. One module's design does not get split across two.

## Goal

Create a document, open it, and let several people edit its blocks at once. The body of
`ROADMAP.md` Phase 1.

PR #43 finished the data layer (`lib/blocks/`) and PR #50 closed Yorkie off behind the workspace
session, so what is left is **the surface**. This task builds no new model; it wires the
`operations.ts` that already exists to the keys a person presses.

### Why document creation (FR-021) is in scope

Not scope creep — the repository already says so:

- `lib/documents/documents.ts`: *"Creating documents is FR-021, and it arrives with the block
  editor that gives a document somewhere to go."* It is read-only today and its fixtures are
  written by hand.
- `app/(workspace)/document-list.tsx`: *"Rows do not navigate. There is no editor to open until
  the block work (FR-022)"* — and `+ 새 문서` is rendered disabled.

With no way to make a document there is nothing to open. Only the minimum create-and-open comes
along.

## Order of work

```
Step 0   Measure IME behaviour      ← before any code; the result picks the surface
Step 1   Write the design section   ← the measurement goes into it
Step 2   Milestones 1 → 6           ← then build
```

`architecture.md` §5 asks for the design doc *before* implementation, and
`document-editing.md`'s own Verification section was built in that order — measure, write, build.
Step 0's result is Step 1's content.

## Step 0 — what to measure first

### What happens when a remote edit lands mid-composition

A React controlled `<textarea value={...}>` has its `value` replaced by a re-render when a remote
edit arrives. If the person is composing Hangul at that moment, the in-progress syllable is lost
or the caret jumps. This is a common failure in collaborative editors, and **the whole task rests
on it** — if it cannot be solved the surface strategy has to be rethought.

To measure:

1. Two browsers, same block, both typing Hangul — does the composition survive?
2. Does deferring the remote patch between `compositionstart` and `compositionend` fix it?
3. Patching only the changed range from `EditOpInfo` (`{ type: 'edit', from, to, value.content }`)
   — does the caret hold? A remote edit before the caret has to push it by the same delta.

The result splits the surface:

- **Passes** → uncontrolled `<textarea defaultValue>` + a composition guard + minimal patching.
- **Fails** → rethink. **A rich-text editor is still not the answer** — see below.

### Why not a rich-text editor

Clear one misconception first: *"we need Notion-style block movement, so a rich-text editor is
out"* is **wrong** as a general claim. Notion-style block editors built on ProseMirror exist
(BlockNote among them). Moving blocks is not something those frameworks cannot do.

**The real reason is on Yorkie's side.** Counted in the 0.7.14 source:

| | move operations |
| --- | --- |
| `yorkie.Array` (`document/json/array.ts`) | `moveBefore`, `moveAfter`, `moveAfterByIndex`, `moveFront`, `moveLast` — **five** |
| `yorkie.Tree` (`document/json/tree.ts`) | **none** (edit / style / split / merge only) |

Binding ProseMirror to Yorkie makes the document a `yorkie.Tree` — exactly what the deleted spike
did (`52350d3`: *"It bound ProseMirror to a `yorkie.Tree`"*), and its patch went with it. So:

```
FR-022-04 (reorder blocks) is required
  → Tree has no move → only delete-then-recreate
    → Verification item 4 measured that: a CRDT cannot be re-parented, and the
      failure is silent (the Text arrives empty, no exception)
    → rebuilding by hand loses whatever a peer typed at that moment
```

On the Array, Verification item 3 measured the opposite: one client moved a block to the end of
the document while another typed into it, the order converged and the typed characters survived.
That is the evidence behind *"why reordering is safe to build on the array"*.

**Worth writing down that this is a trade, not a free win.** A rich-text editor handles IME better
than we are about to — it has already solved what Step 0 asks us to solve. Stated honestly:

> We pay the cost of handling IME ourselves, and buy block movement that is safe under concurrent
> editing.

FR-022-04 is a requirement and Verification found only the Array safe, so the trade is right.
Step 0 is how we find out whether the cost is affordable.

Two secondary reasons: the schema is Agreed and the measurements under it are load-bearing, and
PR #43 already built `lib/blocks/` with tests — adopting a framework now deletes both.

**Shrink the collision surface up front.** Yorkie supports path-based subscription — and types it
(`doc.subscribe('$.blocks.3.content.text', cb)`) — so subscribing per block means a remote edit
elsewhere never touches this textarea. What remains is only "two people in the same block", which
is what occupancy (FR-022-06) exists to discourage.

## Step 1 — the "Editing surface" section in `document-editing.md`

Written from Step 0's result. The schema sections are not touched (Status: Agreed).

- What the surface is (a textarea) and why not a rich-text framework — the `52350d3` reasoning
- Why remote changes are subscribed per block, and the path shape
- The IME rule, carrying Step 0's measurements
- A restatement that writes never travel through the `Block` view model

## Blockers this task has to clear

| Issue | What | Why it blocks |
| --- | --- | --- |
| **#45** | `create.ts`'s factories return `Block` (the view model, `text: string`) while `operations.ts` expects `StoredBlock` (`content.text` is a live `yorkie.Text`). **No function bridges them.** TypeScript does not catch it either — `content` is optional and excess-property checking does not apply to a function's return value | Block creation (FR-022-01) is impossible. `insertBlockAfter(blocks, null, createText())` compiles, stores a block with no `content`, and `contentOf` throws the moment someone types |
| **#44** | `readBlocks` crashes the whole document render on a `null` array element | `readBlocks` is the editor's first call |

## Milestones

> **Dependencies**: M3 and M4 need M2; **M5 and M6 need only M2.** If the type work in M4 drags,
> M5/M6 can land before it.

### 1. Create a document and open it (FR-021, UC-021) + clear the blockers

- **What**: `+ 새 문서` works, and clicking a row opens that document. #44 and #45 close with
  regression tests.
- **Files**: `lib/blocks/` (#45 bridge, #44 guard), `lib/documents/documents.ts` (write path),
  `app/api/documents/route.ts` (new), `app/(workspace)/document-list.tsx`,
  `app/(workspace)/documents/[id]/page.tsx` (new)
- **Reuse**: `lib/chat/chat-repository.ts`'s write pattern — a serializing queue plus
  write-then-rename. It already solved concurrent writes to a host-held JSON file; nothing here is
  written from scratch.
- **Decided**: a new document is seeded with `root.blocks = [createText()]`, so the editor never
  carries an "empty document" special case and can always assume at least one block.
- **Route**: `app/(workspace)/documents/[id]/` — inside the route group, so it inherits the shell
  and `PresenceProvider`.
- **Done**: a new document appears in the list, opens, and survives a reload.
- **Shipped**: `c79a720`. Verified end to end against a live app+Yorkie+Mongo stack — join, create
  (empty-name rejected, repeated name gets `(2)`), list, open, unknown id 404s, unauthenticated
  create refused, record survives on disk.

### 2. Edit a text block (FR-022-02, FR-022-09)

Highest priority. Every other type is built on top of this.

- **What**: `text` blocks render, and typing reaches the other browser.
- **Files**: `app/(workspace)/documents/[id]/editor.tsx`, the block component
- **Reuse**: `readBlocks` to render, `editBlockText` to write. **Writes never go through the
  `Block` type** — as `types.ts` warns, assigning a whole string over a `yorkie.Text` erases a
  peer's keystrokes instead of merging them.
- **Depends on**: Step 0
- **Done**: two browsers typing into the same block keep both sides' characters.
- **Shipped**: `66a4b24`, then `fb54102`. My own script-based verification (real Yorkie, no
  browser) passed and missed a real bug: React Strict Mode double-invokes an effect on mount in
  dev, so `DocumentEditor` fired two concurrent `client.attach()` calls for the same document; the
  cancelled run's successful attach was never detached, and the surviving run's attach then failed
  Yorkie's "not already Attached" filter — surfaced as a misleading "client not found" ConnectError
  that the user hit on first real-browser use. `fb54102` serializes each run's attach behind the
  previous run's full teardown (lessons has the mechanism). After the fix: two real browser windows
  editing the same document concurrently, typing Hangul, held up — no corruption, and the one
  remote-side delay on a composition's last syllable is expected (`document-editing.md`'s "Editing
  surface" §"What was measured").

### 3. Create, delete and move blocks (FR-022-01/03/04)

Still `text` only. Enter to split, Backspace to merge, reordering.

- **Files**: the key handler, `lib/blocks/` (boundary-edit logic)
- **Reuse**: `insertBlockAfter` / `removeBlock` / `moveBlockAfter` as they stand.
- **Done**: all three reach the second browser inside a second (NFR-PER-002).
- **Shipped (Phase A — split/merge; reorder is Phase B, below)**: subscribe callback extended for
  remote `add`/`remove`/`move`; `handleSplit`/`handleMergeWithPrevious` in `editor.tsx`, both
  wrapped for `BlockNotFoundError` (a race that could not exist before this milestone — nothing
  removed a block before); cross-block programmatic focus via a second id→element `Map`, symmetric
  with `registerRemoteHandler`. A heading markdown shortcut (`"# "` and friends) rode along —
  pulled forward from milestone 4's table below, cheap enough (a style-only variant of
  `TextBlockView`, no new component) to build alongside the same `onInput`/`changeBlockType` work.
  Verified live: basic split/merge converge; **concurrent split of the same block converges to 3
  blocks** (both replicas' inserts survive — expected, not a bug, same class as two people typing
  one greeting concurrently); **concurrent merge converges** but duplicates the appended text
  (`"paragraph"` → `"paragraphgraph"` when both sides append independently — the delete is
  idempotent, the text insert is not); the `BlockNotFoundError` guard specifically confirmed against
  the case it exists for (one replica already synced past the other's remove, not just fully
  concurrent). Two bugs found and fixed after real-browser use: (1) `changeBlockType`'s field
  assignments arrive as `set` ops, not `edit` or array ops — the subscribe callback originally only
  watched for those two, so a peer's heading conversion was invisible until some unrelated later
  edit happened to trigger a recompute; widened to any op whose path is `"$.blocks"` or starts with
  `"$.blocks."`. (2) No "always one empty block at the end" — starting a new paragraph required
  clicking into whichever block a peer was actively typing in; `ensureTrailingEmptyBlock` checks
  after every local commit (idempotent, cheap) and appends one via the ordinary `add` path everyone
  already recomputes for. Padding/gap also tightened (16px of dead space between blocks → ~4px) and
  the focus border removed, both cosmetic.
- **Shipped (Phase B — reorder + arrow-key navigation)**: `moveBlockAfter` wired to native HTML5
  drag-and-drop, restricted to a handle visible only on the currently-focused block
  (`group-focus-within`, pure CSS — no JS tracking "which block is focused"); every block is a
  valid drop target, `dropsBeforeTarget` (new pure helper, `lib/blocks/reorder.ts`) resolves
  before/after from the pointer's Y against the target's midpoint, `idBeforeInOrder` resolves the
  actual `afterId`; wrapped in the same `BlockNotFoundError` guard split/merge use (a peer removing
  either block mid-drag is the same race class). ↑/↓ moves focus to the adjacent block from the
  first/last *logical* line (`\n` boundaries, not visual/wrapped ones — a documented ponytail
  simplification); deliberately bypasses `focusBlock`/`pendingFocusRef` and reads `elementsRef`
  directly, since that mechanism is only ever consumed because split/merge always call `setBlocks`
  right after — arrow-nav never touches the block list, so a request routed through it would sit
  unconsumed. Caret lands on the target's matching edge line (last line for ArrowUp, first for
  ArrowDown), not clamped against the whole block — multi-line blocks are real once Shift+Enter is
  in play, not just a hypothetical. Verified live: `moveBlockAfter` convergence between two clients
  confirmed via script; a move-then-concurrent-remove race (server-side, not just app-level)
  converges cleanly with no divergence once both sides finish syncing — the app's own
  `BlockNotFoundError` guard is defense for the *local* replica's `doc.update()` callback, not
  something the CRDT itself needed rescuing from. Drag-and-drop and arrow-key navigation themselves
  are DOM/pointer interactions a script can't exercise — real-browser check is the user's own next
  step, same gap Phase A's Strict Mode lesson already names.

### 4. Add the remaining types, one at a time

Six types are left buildable: `heading` shipped early (Milestone 3, above) via its markdown
shortcut.

| Order | Type | The actual work |
| --- | --- | --- |
| 1 | `quote` | Nearly free — `types.ts` says *"Styling comes from `type` alone"*, so CSS only |
| 2 | `checklist` | A `checked` checkbox |
| 3 | `code` | `font-mono`. **Enter behaves differently** — inside code it is a newline, not a block split |
| 4 | `list` | `style`/`depth`. Consecutive blocks of one style render as a single visual list, and **an ordered list's numbers are computed at render time from position** (`types.ts`: storing them would renumber everything after each insert) |
| 5 | `divider` | **The only type with no text** → no textarea → focus, occupancy and delete all differ |

- **Shipped (quote/checklist/code/list)**: `detectMarkdownShortcut` (generalized from the
  heading-only `headingShortcut`) covers `> `, ` ``` ` (no trailing space — a fence, not a prefix),
  `[] `/`[ ] `, `- `/`* `, `1. `. All four already had full `changeBlockType`/`readBlocks`/
  `toStoredBlock` support from the data layer — this chunk was the shortcut regexes, per-variant
  rendering (`text-block.tsx`'s `BlockVariant`), and two behavioral differences: code's Enter is a
  literal newline (not a split — matches Shift+Enter's existing behavior, and shortcut detection
  itself is now gated to plain-text blocks only, so a code block's own literal "# " can't misfire a
  conversion); list/checklist's Enter continues the same type for the new block, and an *empty*
  list/checklist item's Enter exits back to plain text instead of splitting — no block-type menu
  exists to leave a list any other way. Checklist's checkbox is a native `<input type="checkbox">`,
  not a glyph — same reasoning as the drag handle's Braille lesson below. Ordered numbering
  extracted to `lib/blocks/list-numbering.ts` (its own tests) rather than left inline, since it is
  real arithmetic, not glue. Verified live: `changeBlockType`-equivalent conversions for all four
  converge correctly across two clients, including a checklist toggle read against the *live*
  `checked` value rather than a stale snapshot.
- **Remaining: `divider`.** Decided already, not yet built: render it as a `tabIndex={0}` div, no
  textarea — focus lands on it, occupancy works the same as everywhere else, Backspace deletes it,
  no separate selection model. Needs its own `operations.ts` extension first (`changeBlockType`'s
  `TypeFields` union has no `divider` case yet — it is the one type with no `content` at all, so
  converting to it is not "clear the marker and change `type`" like the four above).

### 5. Show who is in which block (FR-022-06, SIR003)

- **Files**: `app/(workspace)/presence-provider.tsx`, `lib/presence/types.ts`,
  `lib/presence/occupancy.ts` (new), `lib/yorkie-address.ts`
- **Core decision**: `activeBlockId` rides **the content document's presence, not the workspace
  document's**. Yorkie presence is per-document (`presence/types.ts` says so), so
  `getOthersPresences()` *is* the list of people looking at this document and needs no filtering.
  The workspace document was made to *"carry no content of its own"* and to be *"never edited"*, so
  editing state does not go on it. `rosterFrom` also collapses by member id (two tabs → one row),
  which is right for the roster and wrong for occupancy.
- **Provider change**: expose the `yorkie.Client` through the context. It is a local in `useEffect`
  today, and if the editor builds a second client then (a) there are two connections per browser
  and (b) the hole PR #50 just closed reopens quietly — a client with no `authTokenInjector`, which
  PR #50 predicted in as many words: *"a second one built elsewhere would be a connection that
  quietly skipped this"*. For the same reason `fetchToken` moves to `lib/`, so there is no path
  left that builds an unauthenticated client.
- **Teardown**: the attach carries the #32 lesson unchanged — a `cancelled` flag and
  `setup.finally`.
- **Border colour**: `style={{ borderColor }}`, not a dynamic Tailwind class. The JIT scans class
  strings at build time, so a class name assembled at runtime has no CSS behind it.
- **Done**: two browsers focused on different blocks each see the other's coloured border.

### 6. Undo / redo

- **What**: Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z.
- **Reuse**: Yorkie's `doc.history.undo()` / `redo()`. There is no stack to write.
- **Read out of the SDK** (0.7.14 source):
  - The stack holds **local changes only** — `pushUndo` runs right after `localChanges.push(change)`.
    That is the right behaviour for a collaborative editor: you do not undo someone else's edit.
  - Depth is capped at `MaxUndoRedoStackDepth = 50`, oldest dropped first.
  - A new local change clears the redo stack.
  - **Calling it inside a `doc.update()` callback throws** — it has to run outside the handler.
- **Why it is in scope**: the SRS does not ask for it. But the moment M2 patches the textarea
  directly, the browser's native undo breaks — so "not building it" *is* "Ctrl+Z behaves strangely".
  This is paying back debt M2 creates, not adding a feature.
- **Done**: Ctrl+Z reverts only my own change, and the other browser sees it.

## Acceptance

- [x] `pnpm lint`, `pnpm test` and `pnpm build` pass
- [x] A document can be created, opened, edited, and its content survives a reload
- [ ] Two browsers in one document see each other's block create/edit/delete/move within a second
      (NFR-PER-002) — edit confirmed (M2); create/delete/move are M3
- [x] Hangul typed in the same block from both sides never loses a composing syllable — confirmed
      in a real browser (M2), not just the Step 0 spike
- [ ] All seven block types render, edit, and convert between each other — text only so far
- [ ] Occupancy is distinguishable per user and **does not block editing** (SIR003)
- [ ] Ctrl+Z reverts only the local change
- [ ] Restarting the app server leaves an open document's content intact (Phase 1 exit criteria)
- [ ] Restarting the Yorkie container brings the same content back from MongoDB (Phase 1 exit
      criteria)
- [x] #44 and #45 close, with regression tests
- [x] `document-editing.md` carries an "Editing surface" section

> FR-022-12 (reconnection) needs no code — the Yorkie client handles it. No code and *works* are
> different claims, so it still gets **checked**: drop Wi-Fi, keep editing, reconnect, confirm it
> resynchronises.

## Cut

- **The five file-backed and link types** (file/image/pdf/doc-link/block-link). `types.ts` already
  records why: nothing can create them until the File API (FR-022-13/14) and the document tree
  (UC-021/023) exist. The types stay; no renderer is written.
- **Syntax highlighting / CodeMirror in code blocks.** SRS §4.1 asks for "소스코드 또는 고정 폭
  텍스트" and `CodeBlock` carries no `language` field. → #46
- **Block and text colour** → #6 (`AGENTS.md` §7)
- **Document rename / move / delete** (UC-023) → Phase 2
- **Showing more than one occupant** of a block. Never requested, so: first one found wins.
- **Presenter / follow** (UC-030, SIR004) → Phase 3

## Cross-cutting

- **Requirements**: FR-021, FR-022-01/02/03/04/06/09/12, SIR003, NFR-PER-002. `ROADMAP.md` Phase 1.
- **`architecture.md` §2's presence schema** is
  `{ userId, displayName, colorTag, documentId, activeBlockId, viewport, role }`, with `documentId`
  and `activeBlockId` marked "design-only, pending the Document Editing module". `activeBlockId`
  arrives here. **`documentId` does not** — on the content document's presence it is redundant,
  since which document it is is self-evident. **Focus-following (UC-030) reverses that**: a
  follower has not attached to the presenter's document yet, so it cannot read that document's
  presence, and `documentId` then has to live on the **workspace** presence. Out of scope here, and
  written down so that module reads as *adding* to this decision rather than overturning it.
- **#39 (no component tests)**: this is the repo's first substantial UI logic. Key handling, IME and
  boundary editing move into `lib/` as far as they can go, so they are tested without a browser —
  the way `roster.ts` was separated. Whatever cannot move adds evidence to #39.
- **#42 (convergence harness)**: Step 0's measurement is another one taken by hand against
  containers. Decide whether it joins #42 rather than becoming more throwaway scripts —
  `document-editing.md` already says of its own numbers that *"the claims are only as good as this
  document's word"*.

## PR strategy

**One PR.** Six milestones plus two blockers is larger than PR #50 (1132 lines), so it follows
what PR #50 did:

- **Commits shaped like milestones.** PR #50 was eleven commits and a reviewer could walk them one
  at a time. One reason per commit.
- **Harmless halves first.** That is why PR #50 built its milestones 1 → 3 → 2: registering the
  webhook first would have left a window where nobody could attach at all. Same rule here — no
  intermediate commit leaves the app broken.
- **The PR description names a reading order** ("Where to start: this task doc").

## Still open

- The range of markdown shortcuts. `# `, `- `, `1. ` and `> ` are clear; whether ``` ``` ``` (code)
  and `[] ` (checklist) join them can be decided while adding those types in M4.

## Review

Filled in at the end.
