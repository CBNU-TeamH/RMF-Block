# Document Editing — Block Schema

- **Status**: Agreed. All 12 block types finalized; editing surface decided (see [Editing surface](#editing-surface)).
- **Owns**: `lib/blocks/`, `lib/documents/`, `app/(workspace)/documents/`, `app/api/documents/`,
  `app/(workspace)/document-list.tsx`, `app/(workspace)/document-actions.tsx`,
  `app/(workspace)/document-row-menu.tsx` (the sidebar's document tree and its row actions).
  One file under the third path — its use-focus-presence hook — is more specifically owned
  elsewhere, by [`docs/design/presence-and-focus.md`](presence-and-focus.md), whose file-level
  claim wins over this directory-level one.
- **Related**: [`docs/design/architecture.md`](architecture.md) §3(a), §5; [`docs/SRS-ko.md`](../SRS-ko.md) §4.1

## Scope

Field-level Yorkie document schema for each block type listed in SRS §4.1, plus the editing
surface built on it.

## Document structure

```
root.blocks: Array<Block>
Block = { id: string (uuid), type: string, content: <type-specific, see below> }
```

- `root.blocks` is a **Yorkie Array**, not an Object keyed by id. Yorkie's Array is RGA-backed, so concurrent inserts at the same position already converge deterministically — block order is the array position itself, not a stored field.
- Reordering (FR-022-04) uses the array's native `moveAfter`/`moveFront` — no custom merge logic, per ADR-001.
- `id` stays on every block regardless of position, since presence (`activeBlockId`) and the future 블록 링크 블록 need a stable reference independent of array order.
- Block/text color and styling is intentionally not part of any block's `content` below; the question was tracked in [issue #6](https://github.com/CBNU-TeamH/RMF-Block/issues/6) (closed).

## Every text-bearing block wraps its text

All six text-bearing types put the `yorkie.Text` at the same path —
`blocks[i].content.text` — with their own fields as primitives beside it. For
text, quote and code that wrapper holds nothing else, and it is still there.

**Reading flattens it back.** The `Block` types in `lib/blocks/types.ts` expose `text` directly,
not `content.text`, because a renderer reaching for the words should not first have to know which
kind of block it is holding. The wrapper exists for the write path's benefit, not the read path's,
so the read model drops it.

**The reason is block type conversion**, which would otherwise lose the text. Typing `- ` at the start of a
paragraph turns it into a list item; so does picking a type from a menu, or
typing `# `. It is one of the most ordinary things a person does in an editor,
and it must keep the block: the same `id`, so occupancy (FR-022-06) and any
block-link block still resolve, and the same `yorkie.Text`, so a peer typing in
that block at that moment does not lose what they typed.

**Yorkie does not move CRDTs — it silently replaces them.** Assigning an existing `Text`
into a new object leaves an empty `Text` and no error ([ADR-007](../adr/007-block-array-not-tree.md)
has the measurement and the versions it was re-run on). Rebuilding the `Text` by copying the
string across is no better: it drops whatever a peer typed during the conversion, measured on
0.7.13 as `peer edit survived: false`. The conversion must therefore never move the `Text`.

With the uniform wrapper the `Text` never moves, because a conversion only adds
or deletes primitives beside it. Measured: text → list → heading keeps the text
across both hops; a conversion racing a peer's keystrokes converges with both
the new type and the peer's characters; and two people converting the same block
to different types converge on one type with the text intact.

**Leftover fields are left alone, and cleaned up by the next conversion.** In
that last case the losing conversion's fields stay behind — a block that ends as
a heading can still carry a `style` and `depth` from the list conversion that
lost. `type` is a single LWW primitive, so it converges; the fields around it
were separate writes and simply remain. Rendering is unaffected: every reader
gates on `type` and never looks at a field the current type does not own.

A conversion therefore **deletes the fields the outgoing type owned** in the
same `doc.update` that sets the new ones:

```js
doc.update((root) => {
  const block = root.blocks[i];
  delete block.content.level;        // the heading fields being left behind
  block.content.style = "unordered"; // the list fields being taken on
  block.content.depth = 0;
  block.type = "list";
});
```

That is the whole cleanup, and it is deliberately *not* a periodic sweep.

- **The garbage is bounded.** A block has only four fields it can carry beyond
  its text — `level`, `style`, `depth`, `checked` — so the worst a block can
  reach is all four, no matter how many races it survives. Bounded litter is a
  weak case for a collector.
- **A sweep is itself a concurrent write, with no privileges.** A janitor
  deleting `style` from a heading races anyone converting that block back to a
  list, and if the delete wins the result is a list block with no `style` — a
  block missing a field its own type requires. That is strictly worse than dead
  data: readers can ignore a field that should not be there, but not one that
  should.
- **Removing costs more than keeping.** The value is already replicated and
  costs nothing further to sit there; deleting it means an operation that
  syncs to everyone plus a tombstone until GC. A sweep can grow the document.
- There is no compare-and-swap here, so a janitor cannot even read the type and
  delete atomically — the type can change in between.

Folding it into the conversion avoids all of that: it rides a write the person
asked for, which was going to race anyway, and it is self-healing — whatever a
race leaves behind, the next conversion of that block clears.

## Why a catalogue beside Yorkie

The document catalogue in `lib/documents/documents.ts` is separate from Yorkie for a reason the code
cannot show: **Yorkie cannot list documents.** `attach` takes a key the caller already holds, and a
Yorkie document never learns its own name, owner or created time — so a workspace that could only ask
Yorkie would have no way to render a tree. The catalogue holds that metadata and Yorkie holds the
content; a document's `id` is the join between them, which is why it doubles as the Yorkie key and why
renaming (UC-023) changes only the catalogue. It persists as a `.data/` JSON file (write pattern:
[`chat.md`](chat.md) ("Storage")).

## Why an Array of blocks, and not one `yorkie.Tree`

`root.blocks` is a flat Yorkie Array, not a `yorkie.Tree`: `Tree` has no move (FR-022-04), SRS asks
for no inline formatting, and half the types hold no text. What the array costs — splitting,
merging and cross-block selection are ours to build, and a list's `depth` is a number rather than a
parent — and the four SDK measurements the schema depends on are in
[ADR-007](../adr/007-block-array-not-tree.md), asserted by `scripts/verify-yorkie-invariants.mjs`
as a step of CI's `container smoke test` job ([#42](https://github.com/CBNU-TeamH/RMF-Block/issues/42)). The
unit tests under `lib/blocks/` do not cover them: convergence is a claim about two replicas
reconciling through one server, which those hermetic tests exist to avoid needing.

## Block types

### 1. Text block (`type: "text"`)

```
content = {
  text: yorkie.Text
}
```

The wrapper looks redundant with one field in it and is not — see [Every text-bearing block wraps its text](#every-text-bearing-block-wraps-its-text).

Plain text, no inline marks. SRS has no inline-formatting requirement for block content; the presenter highlight/underline tools (FR-030-12~14) are a separate, ephemeral overlay unrelated to stored block content.

### 2. Heading block (`type: "heading"`)

```
content = {
  level: 1 | 2 | 3   // Yorkie primitive, LWW
  text: yorkie.Text
}
```

`level` is a single atomic value, not something requiring char-level merge, so plain LWW is enough.

### 3. List block (`type: "list"`)

```
content = {
  style: "ordered" | "unordered"   // Yorkie primitive, LWW
  depth: number                      // nesting level, 0-based; Yorkie primitive, LWW
  text: yorkie.Text
}
```

One list **item** is one block, not one block per whole list — keeps per-item occupancy (FR-022-06), move, and delete consistent with the rest of the block model. Consecutive same-`style` blocks render as a single visual list on the client; ordered-list numbering is computed at render time from position among consecutive `style: "ordered"` blocks at the same `depth`, not stored, to avoid renumbering conflicts on insert/delete. Nesting requirement: SRS §4.1 목록 블록.

### 4. Checklist block (`type: "checklist"`)

```
content = {
  checked: boolean   // Yorkie primitive, LWW
  text: yorkie.Text
}
```

One task item per block, same reasoning as the list block. No nesting field — SRS §4.1 체크리스트 블록 doesn't call for it, unlike the list block. Add a `depth` field the same way if that changes.

### 5. Quote block (`type: "quote"`)

```
content = {
  text: yorkie.Text
}
```

Same shape as the text block — SRS only calls for emphasizing a passage, no source/attribution fields. `type` alone drives the quote styling on render, which is also what makes text ↔ quote the cheapest conversion there is: nothing but `type` changes.

### 6. Code block (`type: "code"`)

```
content = {
  text: yorkie.Text
}
```

Same shape again. SRS asks for "source code or fixed-width text," not language-aware syntax highlighting, so no `language` field. Fixed-width rendering is a client style concern, not schema. Add `language: string` later if syntax highlighting becomes a requirement.

### 7. Divider block (`type: "divider"`)

```
Block = { id, type: "divider" }
```

The only type with no `content` at all — a divider has no data to hold.

### 8. File block (`type: "file"`)

```
content = {
  fileId: string                          // reference into the File API's store; download/preview go through the File API, not this block
  fileName: string                          // cached at upload time so the block renders instantly on other clients (NFR-PER-002) without a File API round-trip
  fileType: string                          // e.g. mime type or extension — open-ended, not limited to word/ppt/excel
  size: number                              // bytes
}
```

File bytes never enter the Yorkie document — only a reference plus display metadata cached at upload time. Files have no rename operation in the SRS, so this cache can't go stale the way a cached document title could.

`fileType` is a free-form string, not a closed `"word" | "ppt" | "excel"` enum: FR-022-13 allows uploading any file as a file block, FR-022-14 only calls out image/PDF/Word/PPT/Excel for special dispatch — a closed enum would leave no way to represent any other uploaded file type.

**Mapping**: image → image block (9), PDF → PDF block (10), everything else (Word/PPT/Excel and any other file type) → this file block. §4.1 lists 이미지 블록/PDF 블록 as their own kinds distinct from 파일 블록, and only those two need in-block inline preview per their descriptions — other files stay generic embeds, with inline preview handled separately by UC-080's viewer.

### 9. Image block (`type: "image"`)

```
content = {
  fileId: string
  fileName: string
  size: number
}
```

Same pattern as the file block, minus `fileType` (the block `type` already says "image"). No width/height/alt-text/caption fields — no resize or captioning requirement in SRS.

### 10. PDF block (`type: "pdf"`)

```
content = {
  fileId: string
  fileName: string
  size: number
}
```

Identical shape to the image block. No page-count or current-page tracking — not required by SRS, and nothing in the renderer wants them: the block embeds `/api/files/:id/preview` in an `<iframe>` and lets the browser's own PDF viewer do the paging (FR-080-01~03), so page state lives in that viewer rather than in the document. That also keeps the block free of anything per-viewer — two people reading the same PDF block scroll it independently, which is what a shared document with a private reading position should do.

### 11. Document link block (`type: "doc-link"`)

```
content = {
  documentId: string
}
```

No cached title, unlike file blocks. Documents can be renamed/moved (UC-023, FR-021 series), so a cached title would go stale — so the block resolves the name from the catalogue (`GET /api/documents/:id`) and renders an unavailable state when the target is gone.

### 12. Block link block (`type: "block-link"`)

```
content = {
  documentId: string
  blockId: string   // target block's stable `id`, not its array position
}
```

Matches the "문서 ID + 블록 위치 정보" pair used throughout SRS wherever a block reference appears (UC-050, UC-060, UC-070). No cached preview of the target block's content — block content is the highest-churn data in the system, so a cache would go stale faster than anything else considered here.

## Editing surface

See [ADR-008](../adr/008-textarea-editing-surface.md) for this decision as an ADR.

The schema above says what Yorkie holds. This says what turns a key press into an edit on it,
and — the one question worth settling before any of it is built — what happens when a remote
edit lands while a person is composing Hangul (or any IME script) into the same block.

**Decision: a plain `<textarea>` per text-bearing block, uncontrolled, patched imperatively.**
Not a rich-text framework. Not React's `value={text}` binding either, even though that is the
obvious first thing to reach for.

### Why not a rich-text framework

No rich-text framework: binding one to Yorkie makes the document a `yorkie.Tree`, which has no move,
and block reordering is a requirement. We take on IME handling ourselves in exchange; see
[ADR-008](../adr/008-textarea-editing-surface.md).

### Behaviour of the textarea surface

The measured evidence for this surface (a real two-client Yorkie session, on the storage shape
above) is in [ADR-008](../adr/008-textarea-editing-surface.md); what the code does with it:

1. **A naive controlled binding corrupts text under concurrent editing** (the failure story is in
   [ADR-008](../adr/008-textarea-editing-surface.md)). The live constraint: every path that
   changes what Yorkie holds, local or remote, must advance the same diff baseline.
2. **Remote edits arriving mid-composition are queued, then flushed on `compositionend`.** A
   queued edit carries Yorkie's offsets, so the flush applies it to the baseline (Yorkie's text) and puts the composed
   text back where the composition started — the range recorded at `compositionstart`, carried
   through each edit, not inferred by a diff, which cannot place it inside a run of one character.
   If that range no longer fits the textarea (an IME composed away from where it started), the
   flush falls back to the diff's guess.
   The flush runs *before* the composition's commit, which then diffs Yorkie's own text and is
   always an edit Yorkie can apply
   ([#52](https://github.com/CBNU-TeamH/RMF-Block/issues/52), `e2e/ime-replay.e2e.ts`).
3. **Patching reads the SDK's `EditOpInfo` offsets** (against the pre-edit string), so an edit
   entirely before the caret shifts it by the size difference and one entirely after leaves it
   alone.
4. **A composed syllable is one edit**: `compositionstart` suppresses per-keystroke syncing and
   `compositionend` commits the finished syllable as a single diff.

### Subscribing to remote changes

Yorkie's path-based `subscribe` is typed against the document shape (e.g.
`$.blocks.0.content.text`), which is enough to shrink what a remote change can disturb — a block
component only needs to react to edits on its own text, not the whole document.

**The path is positional, not by block id.** `$.blocks.0.…` names whatever sits at array index 0
*right now*; a block does not carry its path with it when another block is inserted, removed, or
moved ahead of it (see [Document structure](#document-structure): position is meaning here, on
purpose, per ADR-001). A component subscribing once to a fixed path string goes stale the moment
the array changes shape elsewhere. The editor has to re-derive each block's current path from its
`id` on every structural change, or subscribe once at the document root and match operations by
walking `path` against the current array — a fixed-path subscription per block, kept for the
block's whole life, is the one option ruled out by this.

### Operations name a block by `id`, never by index

The same hazard on the write side. Every function in `lib/blocks/operations.ts` takes a `BlockId`
and resolves it to a Yorkie `TimeTicket` at call time; none of them accepts an array position. An
index is a fact about one replica at one moment — a peer inserting above you shifts it, and the
operation lands on the wrong block. Yorkie's own operations carry `TimeTicket`s rather than
indices for exactly this reason, and `moveAfterByIndex` exists but is not used here.

The resolution is a linear scan of the array, deliberately. A document a person actually reads is
not long enough for that to cost anything, and an `id`→ticket index would be a second structure to
keep true across every remote change — the same class of duplicated state that S-2 in
[`docs/conventions.md`](../conventions.md) forbids.

### Writes never go through the `Block` view model

Restated because the surface is where it would be easiest to forget: `editBlockText` (or
whatever calls `yorkie.Text.edit()` under it) is the only way text changes, never an assignment of
a whole string over the field. `lib/blocks/types.ts` already says why — a `Block`'s `text: string`
is read-only shape, and assigning it back would erase whatever a peer typed at that moment instead
of merging with it.

## The registry is one table, and the table's shape is the argument

`lib/blocks/registry.ts` holds one entry per block type. The reason it is a `Record` keyed by the
`BlockType` union rather than a `switch` with a `default` is exhaustiveness: **leave a key out and
it does not compile.** Measured against the `switch` it replaced: adding a member to the union gave
*one* compile error and *five* silent runtime fallbacks, one of which dropped the block from the
document. A `default` branch turns "we forgot this type" into a value.

### Four surfaces, not twelve types

Renderers branch on a **surface**, not on a type: `text` (edited through one `<textarea>`),
`embed` (a file rendered in place, bytes behind a `fileId`), `link` (a pointer at another document
or block), and `none` (the divider). Twelve types collapse into four ways of behaving, and a
renderer written against the surface keeps working when a type is added to a surface it already
handles.

The `surface` field is constrained against the union rather than free-form: a type carrying `text`
**must** be declared `"text"`, and one that does not **cannot** be. That constraint is what makes
`isTextBearing` a sound type guard whose runtime answer comes from the table — without it the
guard would be a promise the table could quietly break.

`continuation` says what pressing Enter at the end of a block leaves behind. Omitted means a plain
text block, which is right for everything except the three types that "run": a list stays a list
until you leave it.

## Reordering: what a drop means

`lib/blocks/reorder.ts` keeps the order questions apart from the DOM, the same way
`text-surface.ts` keeps IME and diff maths apart from the `<textarea>` — so both are testable
without a browser. Order is the one thing the `blocks` state array is reliable for.

A drop is compared against the target block's **vertical midpoint**, not its top edge: a drop
anywhere in the bottom half of a block means "after this one".

`dropDestination` returns `{ afterId }` or `null`, and the wrapper matters — a legitimate `null`
("insert at the front") has to stay distinct from "this drop moves nothing". Three cases move
nothing: dropping a block on itself, dropping it after itself, and dropping it into the slot it
already occupies.

**One rule, two callers, on purpose.** The insertion line is drawn only where `dropDestination`
returns a destination. When the line and the drop each decided for themselves, they drifted, and
the line promised drops that did nothing.

## Attaching under React's Strict Mode

Strict Mode double-invokes an effect on mount in development — mount → cleanup → mount,
**synchronously**. For a Yorkie attachment that means two `attach()` calls back to back for the
same document key from the same client. Measured: the second fails with a misleading
`"client not found"`, because Yorkie's server-side `TryAttaching` filters on the document not
already being Attached for this client, and a cancelled run whose `attach()` succeeded anyway was
never detached.

The fix is to **chain one run's full teardown (unsubscribe + detach) in front of the next run's
`attach()`.** React runs cleanup(N) before effect(N+1) even in the synchronous double-invoke, so the
previous run's teardown is exactly what the next attach must await — and the attach never reaches
the server while the previous run's document is still marked Attached.

A content document does this through **`lib/documents/attach-pool.ts`**'s per-key `tail`, and the
pool exists because it has more than one holder: the editor, and any floating view of one of its blocks (UC-070). Yorkie refuses
a second `attach` of a key the client already has, so the pool keeps one attachment per key and a
refcount. That same shape covers Strict Mode: the second run's `acquire` lands before the first
run's `release` (which waits for its own setup to settle), so the count goes 1→2→1 and nothing
re-attaches. When the count does reach 0, the next `acquire` of that key waits for the detach in
flight (the chain above, held per key).

### Seeding a brand-new document is a known race

Two people opening the same empty document at once can both see it empty and both seed it. `blocks`
is last-write-wins as a whole, so one seed replaces the other outright. This is the same category
of race a two-person `changeBlockType` already accepts, and is [#42](https://github.com/CBNU-TeamH/RMF-Block/issues/42) material if it ever matters at
this app's scale. How the SDK reports a whole-array seed is also tracked there; `touchesBlockList` in
`lib/blocks/text-surface.ts` accepts `$.blocks` and `$.blocks.*`.

### Routing a remote text edit

A remote edit is applied to one block's textarea rather than by rebuilding the list, because the
node to patch is known and a rebuild costs the caret. Two details make that safe:

- **The block list is recomputed at most once per event, not once per matching op.** A markdown
  conversion alone produces two ops (a `set` on `type`, a `set` on `content`), and a multi-block
  paste or reorder more. Recomputing is an O(n) read of the whole array, so it happens once per
  batch.
- **A block with no handler registered yet falls back to a rebuild.** Its row exists in the
  document but has not mounted, so the textarea that would take the patch does not exist. Dropping
  the op would leave that block showing its mount-time text forever — a peer creating a block and
  typing into it does exactly this within a frame or two. The rebuild remounts the row with the
  text the document holds *now* (#59).

A split or merge is patched through **the same handler a remote edit uses**, deliberately. That is
what keeps the block's diff baseline in step; writing `el.value` from outside would fix the display
and leave the next keystroke diffing against the wrong string.

## Rules the editor component holds to

**Every mutation reads text and `checked` live, never from `blocks` state.** That state's `text` is
a snapshot taken
at the last render and goes stale the moment anyone types — locally or remotely. A split that
trimmed the snapshot would drop a concurrent remote edit past the caret; a checkbox that toggled
the snapshot would flip from a value that is no longer there. So `editor.tsx` reads the block out
of the live document inside the same `doc.update()` that writes it. Order, type and depth (indent, `preservingDepth`) are read from state: it is reliable for them.

Reading it means iterating the array (`for...of`), not `.find`; `.elements()` is for when the
`TimeTicket` is needed (`operations.ts`). `JSONArray<T>`'s `Array<T>`
typing is a compile-time claim about a proxy; only iteration is known to work at runtime.

**One mutation path.** Every local edit goes through one helper that runs the mutation and
republishes the list, and `setBlocks` happens nowhere else. It returns `false` when the edit did
not land — no document attached, or a peer removed the block first. That is never an error to
report: the peer's operation is the one that stands. Callers with follow-up work (a caret to move,
a trailing block to append) check the result.

**One empty text block is kept at the end,** so starting a new paragraph never means clicking into
a block someone else is typing in. It is idempotent, so running it after every text commit costs
one read, and it is enforced locally only — the append reaches peers as an ordinary add.

### The `/` menu's highlight has to stay on screen

The item list can exceed the menu's max height. Arrow keys
move the highlight through every item, which means the highlight can land where nobody can see it —
the menu looks frozen while it is in fact responding.

The list scrolls to follow, by arithmetic (`scrollTopForHighlight` in `slash-menu.ts`) rather than
`element.scrollIntoView()` ([the general rule](../conventions.md#scroll-a-container-never-scrollintoview)). **`scrollIntoView` walks every scroll ancestor**, and this editor's
scroll container publishes a focus anchor whenever it moves (FR-030-07) — nudging the page to
reveal a menu row would send every follower to a position the presenter never looked at. Computing
the number and assigning `list.scrollTop` touches the menu and nothing else.

The `<ul>` is `absolute`, which makes it its rows' `offsetParent`, so a row's `offsetTop` is already
in the coordinate space `scrollTop` is measured in — the same requirement `lib/focus/dom.ts`
documents for block boxes.

One edge the helper handles: a row taller than the viewport cannot be shown whole, so it stops at
the row's own top rather than scrolling past it. Cutting off a row's first line is the worse half
to lose.

### Leaving a code block

Enter inside a code block is a literal newline — code is source text, not a sequence of blocks.
That leaves no way out, since a code block has no marker to retype and the `/` menu does not open
inside one. **A second Enter on a blank line at the very end exits it.** The "at the very end"
half matters: a blank line in the middle of otherwise real code is code, and must stay.

Two guards elsewhere in the same component draw the line differently. Only a **plain text** block
converts on a markdown marker: in a code block `# ` is source text, and in a heading retyping a
marker asks for a conversion that has already happened. The `/` menu opens in **every text-bearing
block except code** (#145) — in code `/` is source text too, but elsewhere the menu's items are
conversions *to* another type, so `/텍스트` is how a heading becomes a paragraph again. The `/`
menu's query is recomputed from the text rather than tracked as a session, so deleting back
through the slash closes it on its own. It is recomputed mid-composition too, and matched jamo by
jamo (`slashMenuItems`), so the menu narrows at each step an IME shows (`ㅈ`, `제`, `젬`, `제모`)
instead of waiting for the word.

The query matches a *prefix* of a label word, the English `name` or a keyword (not a substring);
label and name matches come first in menu order, keyword-only matches after. When nothing matches,
a 결과 없음 row replaces the menu and owns no keys — Enter still splits the block. Escape dismisses the
menu or the row, and blur closes it (the menu's own `mousedown` is prevented so dragging its
scrollbar keeps focus). While an IME composition is open, Enter, the arrows and Escape belong to
the IME.

### `/페이지` makes a page; `/문서 링크` points at one

Two menu items, because they are two things. `/문서 링크` picks a document that already exists.
**`/페이지` creates a new one inside this document, links to it, and opens it** — the Notion
gesture, where a page is somewhere you make on the way rather than something you go and set up
first.

The new document is a **child of the one it was typed in**. That is what keeps it in the workspace
tree rather than only in this document's blocks: the tree reads the catalogue, and `parentId` is
what puts it under the page it came from. Nothing about the tree is special-cased for this — the
same `POST /api/documents` the workspace home calls, with a parent.

The three steps run in an order that cannot strand any of them: **document, then block, then
navigate.** A link written before the document existed would point at an id the catalogue does not
have; a block written after navigating would be written into an editor that has unmounted. Failing
at the first step leaves nothing behind at all, and the dialog says so.

It asks for a name rather than defaulting to 제목 없음, because nothing in the editor renames a
document yet — a placeholder name would be one nobody could change from where they are standing.

### The document link block

SRS §4.1 type 11, created from the `/` menu. **Only the target's id is stored.** A file block
caches its name because a file has no rename in the SRS; a document does (FR-023-01), so a cached
name would go stale the first time anyone used it. The name is read from the catalogue when the
block draws.

**A link to a deleted document is a state, not an error.** FR-023-04 deletes documents and nothing
rewrites the blocks pointing at them, so the block renders as unavailable — the same shape a file
block whose bytes are gone already uses. The state can end: a delete goes to the host's trash, and a restore
brings the link back to life. The deleted document's own file blocks, hidden while it is in the
trash, come back the same way ([`api.md`](api.md#files)). The picker leaves the current document out of its own
list, since a link to the page you are on is a loop with only a back button out.

`block-link` (type 12) still has no creator: it needs a way to point at one block inside a
document, which nothing offers yet.

## Undo is per person, and it is Yorkie's

`Ctrl/Cmd+Z` undoes, `Ctrl/Cmd+Shift+Z` redoes. No FR asks for either; they are here because they
are the first keys anyone presses.

**The undo stack is per client, and that is what makes this safe.** The SDK guide states it —
*"History tracks only local changes. Remote changes are applied but not added to undo/redo
stacks"* — and the source agrees: `pushUndo` is reached only from the local `update()` path,
immediately after `localChanges.push(change)`, while remote changes arrive through
`applyChanges(…, OpSource.Remote)` and never touch it. So an undo takes back *this browser's* last
edit and never a peer's — the only version of undo a shared document can have, and the reason this
is the SDK's job rather than something built here.

**Undo works because blocks are an Array** ([ADR-007](../adr/007-block-array-not-tree.md)); a
`yorkie.Tree` could not have it yet.

**`undo()` must not be called inside a `doc.update()` callback** — the guide says it throws
*"Undo is not allowed during an update"*. Nothing here does: the only caller is a keydown handler,
which runs outside every update callback. Written down because the two would be easy
to combine later — an "undo this block" button inside an edit, say.

**The redo stack clears once a new change is made after an undo.** Standard, and worth knowing
before someone reports it: undo, type, and the thing you undid is not coming back.

**An undo publishes `local-change`, not `remote-change`**, with `source: OpSource.UndoRedo`. A
local edit is the caller's to apply and republish, and an undo has no caller to do that, so
`use-block-document` handles an undo's `local-change` like a remote one: a change nothing local is
already holding the text for. Everything downstream — the op-routing loop, `touchesBlockList`, the per-block
handler map, the rebuild fallback — is the remote-change path.

**The browser's own undo has to be stopped.** A `<textarea>` keeps its own edit history, and
`Ctrl+Z` inside a focused one would rewind the DOM while Yorkie kept the text — the desync
[#59](https://github.com/CBNU-TeamH/RMF-Block/issues/59) was about. The keydown handler calls
`preventDefault` so the document's history is the only one.

### The floor

**Nothing from before the document was opened may be undone.** Opening an empty document seeds it
with a first block through `doc.update()`, and undoing that would leave a document with no blocks
and nowhere to type.

Measured against 0.7.13, the seed's root assignment happens to produce no reverse operation, so the
stack is empty at that point anyway — but that is an accident of which operation the seed uses, not
a design. `use-block-document` records the stack depth once the document is ready and refuses to
undo past it.

The stack is capped at 50 entries (`MaxUndoRedoStackDepth`), so undo is not a journey back to the
empty document.

### Pasting more than one line

**A single-line paste is not a block operation.** It goes through the textarea's own default,
which already lands at the caret, mid-word, and fires `onInput` after. Only a newline in the
clipboard makes a paste structural — which keeps the common paste on the path that already works,
and means the code below is never reached by the ordinary case.

A multi-line paste becomes one block per line. **The first line reuses the block being pasted
into** rather than inserting above it: that block already holds the caret, and making a new one to
replace it would move focus for no reason. Its whole text is replaced, not spliced at the offset —
a multi-line paste is a structural edit, and splitting a word in half to make the front of it a
heading is not what anyone means by one.

Each line is parsed on its own by `lib/blocks/paste.ts`, and a markdown marker at the start of a
line converts that line's block. This needs its own parser: `detectMarkdownShortcut` matches a
marker as a block's **entire** text (`"# "` triggers, `"# hello"` does not), which is right for
typing — the conversion has to fire as the marker completes — and useless for a paste, where the
marker always arrives with its line. The marker table is still the one authority; `paste.ts` hands
it the marker alone and keeps the rest as text.

`[x] ` is the one marker only a paste can carry. Nobody types it — you type `[] ` and click — so
`detectMarkdownShortcut` does not know it, correctly, and `paste.ts` reads the checked state
itself.

One trailing newline is dropped, because that is how a copied paragraph ends rather than a request
for an empty block after it. Blank lines *between* lines are kept: those are the person's own
spacing.

### Indenting a list item

SRS §4.1 gives 목록 블록 nesting — "항목을 들여쓰기하여 중첩(하위 목록)할 수 있다" — and `depth`
carries it in the schema. `Tab` and `Shift+Tab` are what set it,
and `lib/blocks/indent.ts` holds the rule.

**Indent is capped by the block above, not by the block itself.** Indent raises the depth by one
only when that stays within the ceiling, `min(previousListDepth + 1, MAX_LIST_DEPTH)`; otherwise
nothing changes, so an item can never end up more than one level deeper than the item above it.
Without that cap a depth-2 item can sit under a depth-0 one and render as
a child of nothing. A list item with no list above it therefore cannot indent at all, and a
non-list block above ends the run — nesting under a paragraph is not something this model can
express. Outdent has no such rule: a stray nested item must always be able to come back out,
however it got there, so it is `max(depth - 1, 0)`.

`MAX_LIST_DEPTH` is 5. Past that the text column is narrower than the indent that pushed it, which
reads as broken rather than nested.

**It is a bound on the model, not on the gesture.** `depth` arrives from storage and from the LAN,
where nothing validates a write (`api.md` §2), so the ceiling has to hold for values no keypress
produced. `listDepth()` in `document.ts` is the one normalizer, applied wherever a depth enters:
`readBlocks`, `changeBlockType`, and `createList`.

Clamping the low end is not enough, and the failure is not cosmetic. `orderedListNumbers` sizes an
array from the depth — `counters.length = depth + 1` — so `depth: 4294967295` throws
`RangeError: Invalid array length` and takes the whole editor's render down. A non-numeric value
does the same, because `Math.trunc` of one is `NaN` and `counters.length = NaN` throws as well.
`readBlocks` alone closes that path, since every rendered block comes through it; the other two are
there so the value is never stored in the first place.

**Tab is intercepted only on a list block.** Everywhere else it keeps its default and moves focus.
Trapping Tab inside every textarea would leave a keyboard user unable to get out of the editor, and
that trade — one key on one block type — is cheaper than an editor nobody can leave.

Checklist blocks do not nest. SRS §4.1 gives nesting to 목록 only, and `TypeFields` carries `depth`
only on `list`; extending it is a model change and an SRS question, not an oversight.

Ordered numbering counts each depth separately, so an indented run starts its own `1.` and coming
back out resumes the outer sequence. A counter is dropped when its level is left, which is what
makes a second indented run under a different parent start at 1 rather than continue the first.

#### A conversion must not flatten what it did not mention

`changeBlockType` treats `TypeFields` as the whole target state and drops every owned field the
caller did not name — deliberately, so a conversion cannot leave the previous type's fields behind.
That is right for `level` and `checked`, and wrong for `depth`: **changing a bullet to a number is
a style change, not a re-parenting**, and an item three levels in should stay three levels in.

Neither caller can name the depth itself — the `/` menu's items are static and a markdown marker
carries none — so `preservingDepth` (`lib/blocks/indent.ts`) carries it from the block being
converted, at both call sites.

`level`, `style` are not protected the way `depth` now is — the same silent-flatten shape applies
to either of them the moment two block types share one, and nothing today would catch it before a
user does.

### Three places a drag can land

Reordering (FR-022-04) carries the dragged id in the browser's transfer data rather than in
component state, because `dragstart` and `drop` can fire on different renders. Where it lands is
`dropDestination`'s answer, which is also what the insertion line is drawn from, so the two cannot
disagree.

| zone | what it means | why it must claim the drop |
| --- | --- | --- |
| a block | before or after it, by midpoint | the ordinary case |
| the footer | at the very end | it is not a block, so it cannot answer "before or after?" from its own rect and passes `forcedBefore` |
| the padding beside the blocks | nothing | a block drag that reaches the container passed every block without being claimed; without `preventDefault` the browser shows "no drop", and the line is cleared rather than left promising a landing spot the release would decline |

The empty space *under* the document is the footer's `flex-1` region — which is exactly where a
block is dragged when the intent is "put it at the end". File drags are left to bubble
to the container, which already appends them.

## Open questions

- Block/text color and styling: [#6](https://github.com/CBNU-TeamH/RMF-Block/issues/6).
