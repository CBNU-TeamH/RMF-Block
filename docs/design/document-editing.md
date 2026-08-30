# Document Editing — Block Schema

- **Status**: Agreed. All 12 block types finalized. The pre-implementation SDK convergence check it was waiting on has been run — see [Verification](#verification-2026-08-27). The [editing surface](#editing-surface) (textarea vs. rich text, IME handling) was decided 2026-08-30, ahead of `tasks/active/20260829-block-editor-todo.md`'s implementation milestones.
- **Related**: [`docs/design/architecture.md`](architecture.md) §3(a), §5; [`docs/SRS-ko.md`](../SRS-ko.md) §4.1

## Scope

Field-level Yorkie document schema for each block type listed in SRS §4.1, plus the editing
surface built on it. Per `architecture.md` §3(a)/§5, this doc is written just-in-time — the
schema block type by block type, the surface just before the editor's implementation task starts.

## Document structure

```
root.blocks: Array<Block>
Block = { id: string (uuid), type: string, content: <type-specific, see below> }
```

- `root.blocks` is a **Yorkie Array**, not an Object keyed by id. Yorkie's Array is RGA-backed, so concurrent inserts at the same position already converge deterministically — block order is the array position itself, not a stored field. This replaces the `order` field originally sketched in `architecture.md` §3(a).
- Reordering (FR-022-04) uses the array's native `moveBefore`/`moveAfter` — no custom merge logic, per ADR-001.
- `id` stays on every block regardless of position, since presence (`activeBlockId`) and the future 블록 링크 블록 need a stable reference independent of array order.
- ~~**Open risk**: `yorkie-team/yorkie#676` reported non-convergence when the moved element is also the reference element in a concurrent `moveAfter`.~~ **Verified on the pinned 0.7.13, 2026-08-27** — see [Verification](#verification-2026-08-27).
- Block/text color and styling is an open decision (`AGENTS.md` §7) and intentionally not part of any block's `content` below — see that TODO item for why deferring it doesn't require reworking this schema.

## Every text-bearing block wraps its text

All six text-bearing types put the `yorkie.Text` at the same path —
`blocks[i].content.text` — with their own fields as primitives beside it. For
text, quote and code that wrapper holds nothing else, and it is still there.

**The reason is block type conversion**, which this schema originally made
impossible to do without losing the text. Typing `- ` at the start of a
paragraph turns it into a list item; so does picking a type from a menu, or
typing `# `. It is one of the most ordinary things a person does in an editor,
and it must keep the block: the same `id`, so occupancy (FR-022-06) and any
block-link block still resolve, and the same `yorkie.Text`, so a peer typing in
that block at that moment does not lose what they typed.

The first draft gave text, quote and code `content = yorkie.Text` directly while
heading, list and checklist nested it. Converting between the two groups then
meant moving an existing `Text` under a new parent, and **Yorkie does not move
CRDTs — it silently replaces them**. Measured on 0.7.13: assigning an existing
`Text` into a new object throws nothing, reports a `Text` afterwards, and that
`Text` is empty. The paragraph's contents are simply gone, with no error
anywhere. Rebuilding the `Text` by hand and copying the string across is no
better: it also drops whatever a peer typed during the conversion, measured as
`peer edit survived: false`.

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

## Why an Array of blocks, and not one `yorkie.Tree`

Recorded after the fact: the structure above was chosen without this comparison
written down, and the reference project we borrow from went the other way.
[wafflebase](https://github.com/wafflebase/wafflebase)'s document editor stores a
whole document as a single root-level `yorkie.Tree`.

Their choice is right for what they build and wrong for what we build.

**What `Tree` is good at.** A word processor's document *is* a hierarchy —
`doc > table > row > cell > paragraph > inline > text`. Inline formatting
(bold, font, colour) applies to a *range*, which `Tree.style(from, to, attrs)`
expresses directly. Splitting and merging paragraphs on Enter/Backspace is one
tree operation. `@yorkie-js/prosemirror` binds ProseMirror to a `Tree`, which
buys an enormous amount of editor behaviour for free.

**Why none of that pays here.**

- **SRS asks for no inline formatting.** "Plain text, no inline marks" under
  the text block below is not a simplification we chose — it is the requirement.
  `Tree`'s biggest advantage is unused.
- **Five of the twelve types hold no text at all** — divider, file, image, PDF,
  and the two link blocks. As tree nodes they are attribute-only leaves, which
  is a shape the tree model tolerates rather than serves.
- **FR-022-06 and the block-link block both need a stable per-block id.** A
  block that is an array element with an `id` field gives that plainly.
- **`Tree.move` is not implemented.** `packages/sdk/src/document/crdt/tree.ts`
  throws `ErrUnimplemented` with the note *"TODO: Implement this with keeping
  references of the nodes."* FR-022-04 is a hard requirement, and the only way
  to reorder a tree today is delete-and-reinsert — which mints new nodes, so a
  peer's concurrent edit to the moved block lands on the deleted ones and is
  lost. `CRDTArray.moveAfter` keeps the element and moves only its position.
  Measured: see [Verification](#verification-2026-08-27) item 3.

**What the array costs us**, stated plainly so nobody rediscovers it as a
surprise: everything that crosses a block boundary is ours to build. Splitting a
block on Enter, merging into the previous one on Backspace at offset 0, and
selecting across blocks are all free under `Tree` and are the real work of the
editing module here. Nesting is also flattened — a list's `depth` is a number on
a flat block, not a real parent-child relation.

## Verification (2026-08-27)

Run against `yorkieteam/yorkie:0.7.13` on `mongo:8` with the pinned
`@yorkie-js/sdk@0.7.13`, not from the SDK's documentation.

1. **A `yorkie.Text` nested in an array element is a live CRDT.** wafflebase's
   `slides-document.ts` carries a warning that a `yorkie.Tree` nested inside an
   array element is serialized to plain JSON — reads see an inert object, writes
   silently no-op — and that they reverted such a migration. `root.blocks` is
   that same shape, so it was checked directly: a second client attaching to an
   existing document receives `blocks[0].content` as a `Text` instance with a
   working `edit()`, concurrent character-level edits from two clients converge
   with both edits present, and a third client attaching cold reads the merged
   result. The same held for a nested `Tree`, so the warning does not reproduce
   at this depth on this version.
2. **Concurrent `moveAfter` converges where `yorkie#676` said it might not.**
   Two clients each moved a block *past the block the other was moving*, so each
   side's reference element was the other's moved element. Both converged on the
   same order, no block was lost, and a cold third client agreed. The source
   supports it: `RGATreeList.moveAfter` resolves competing moves as a
   last-write-wins position register, and deliberately still creates the losing
   move's position node — commented *"so that operations referencing this move's
   position can find it"* — which is the referential-integrity case the issue was
   about.
3. **A move preserves the moved block's text, including a peer's concurrent
   edit.** One client moved a block to the end of the document while another
   typed into that same block. The order converged and the typed characters
   survived. This is the property `Tree` cannot offer while `move` is
   unimplemented, and it is why reordering is safe to build on the array.

4. **A CRDT cannot be re-parented, and failing to do so is silent.** Assigning
   an existing `yorkie.Text` into a newly-created object under the same document
   raised no error, produced a `Text` at the destination, and that `Text` was
   empty — the original characters were not carried over and no exception marked
   their loss. Rebuilding the text by hand instead loses a peer's concurrent
   keystrokes. This is what forced the uniform `content.text` wrapper above; the
   full measurements are in that section.

Not yet verified: convergence under more than two concurrent movers, and
`moveAfter` interleaved with a concurrent delete of the reference block.

**None of the above is reproducible from this repository.** Every measurement
here was taken with throwaway scripts against containers started by hand, and
they are gone. A reader who doubts a number, or a future SDK bump that needs
these rerun, has nothing to run — the claims are only as good as this document's
word. Committing the harness is tracked as
[#42](https://github.com/CBNU-TeamH/RMF-Block/issues/42); the two unverified
cases belong in it rather than in another set of throwaway scripts.

That matters more than usual here, because these measurements are load-bearing.
They are why every block's text is wrapped (`content = { text }`) and why blocks
are a Yorkie Array rather than a `yorkie.Tree`. If a future SDK version changes
one of them the schema is wrong, and nothing in CI would say so.

The unit tests under `lib/blocks/` deliberately do not cover this ground. A
`yorkie.Document` needs no client and no server, which is what makes those tests
fast and hermetic, but convergence is a claim about *two* replicas reconciling
through one — so it cannot be asserted without the thing those tests exist to
avoid needing.

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

Identical shape to the image block. No page-count or current-page tracking — not required by SRS.

### 11. Document link block (`type: "doc-link"`)

```
content = {
  documentId: string
}
```

No cached title, unlike file blocks. Documents can be renamed/moved (UC-023, FR-021 series), so a cached title would go stale — and unlike file metadata, the document tree is core navigation state every client already keeps loaded, so resolving `documentId` to a title needs no round-trip anyway.

### 12. Block link block (`type: "block-link"`)

```
content = {
  documentId: string
  blockId: string   // target block's stable `id`, not its array position
}
```

Matches the "문서 ID + 블록 위치 정보" pair used throughout SRS wherever a block reference appears (UC-050, UC-060, UC-070). No cached preview of the target block's content — block content is the highest-churn data in the system, so a cache would go stale faster than anything else considered here.

## Editing surface

The schema above says what Yorkie holds. This says what turns a key press into an edit on it,
and — the one question worth settling before any of it is built — what happens when a remote
edit lands while a person is composing Hangul (or any IME script) into the same block.

**Decision: a plain `<textarea>` per text-bearing block, uncontrolled, patched imperatively.**
Not a rich-text framework. Not React's `value={text}` binding either, even though that is the
obvious first thing to reach for.

### Why not a rich-text framework

*"We need Notion-style block movement, so a rich-text editor is out"* is not the reason, and is
not even true in general — ProseMirror-based Notion-style editors (BlockNote, for one) exist.
The actual reason is specific to Yorkie: binding a rich-text framework's document model to Yorkie
makes it a `yorkie.Tree`, and `yorkie.Tree` has no move operation at all —

| | move operations |
| --- | --- |
| `yorkie.Array` (this schema's `root.blocks`) | `moveBefore`, `moveAfter`, `moveAfterByIndex`, `moveFront`, `moveLast` |
| `yorkie.Tree` | none |

— while [Verification](#verification-2026-08-27) item 3 measured that `Array`'s move survives a
concurrent edit to the moved block, and item 4 measured that a `Tree`-shaped rebuild does not:
re-parenting a CRDT is silent data loss, not an error. Reordering blocks (FR-022-04) is a
requirement, and only one of the two shapes was measured safe under it. Adopting a rich-text
framework now would also discard `lib/blocks/`'s tested `operations.ts`, built against the array
shape this schema settled on.

The honest framing: we take on IME handling ourselves in exchange for block movement that is
safe under concurrent editing. A rich-text framework would have handed us IME for free — it has
already solved what the rest of this section solves — so the next part existed to check whether
that cost is actually payable.

### What was measured (2026-08-29–30)

Against a real two-client Yorkie session (0.7.13), using a throwaway harness at
`app/(workspace)/spike/ime-harness/` (deleted once this section landed) that exercised the exact
storage shape above — `root.blocks[0].content.text`, edited through `yorkie.Text.edit()` — rather
than a bare string.

1. **A naive controlled binding corrupts text under concurrent editing**, but not for the reason
   first assumed. `<textarea value={text}>` re-rendering `value` from an incoming remote edit
   does interrupt an in-progress IME composition in the way collaborative editors are known to
   suffer from — but the sharper failure measured here was a bug in the harness itself: the
   local diff baseline (`lastSyncedRef`, "what I last told Yorkie the text was") did not get
   updated on the remote-render path, so the very next local keystroke was diffed against a
   stale, shorter string and reinserted the *entire visible textarea content* as if it were new.
   Two people typing "안녕하세요" into the same empty block concurrently produced
   `"안안녕녕하세요"` — the whole greeting duplicated, not merely a lost syllable. **The lesson
   generalizes past this one bug**: any surface that reads "the current text" from one source
   (React state) while diffing against a second, independently-updated source (a sync baseline)
   has to keep the two in lockstep on *every* path that touches either — the remote path is as
   much a mutation of "what Yorkie holds" as the local path is, and both have to advance the same
   baseline.
2. **An uncontrolled textarea, patched only on the changed range, survives.** Two live clients
   typing Hangul into the same block concurrently: remote edits arriving mid-composition are
   queued rather than applied, flushed once `compositionend` fires, and the in-progress
   composition was not observed to break in either the corrupted-duplication way above or the
   composition-interruption way rich-text frameworks are built to avoid. Non-composing keystrokes
   (plain ASCII, Enter, space) sync per keystroke with no queuing needed.
3. **The SDK's own `EditOpInfo` carries exactly what patching needs**: `{ from, to, value:
   { content }, path }`, character offsets against the pre-edit string. Caret adjustment measured
   against a live remote edit: an edit entirely before the caret shifts it by the size
   difference (measured: caret at 5, a 1-character insert at position 1, caret becomes 6); one
   entirely after the caret leaves it alone.
4. **A composed syllable is one edit, not one per candidate**, when composition is guarded:
   `compositionstart` suppresses per-keystroke syncing and `compositionend` commits the finished
   syllable as a single diff. The naive binding sends one edit per intermediate IME candidate
   (measured: "안" alone produced three edits — `"ㅇ"` → `"아"` → `"안"` — before the composition
   even ended), which is not just noisier but means Yorkie's own `doc.history.undo()` (§6 of the
   editor task) would step back through IME candidates rather than through what a person thinks
   of as a character.

**Not yet measured**: composition survival at a network delay long enough that several remote
edits queue before `compositionend` fires, and behaviour with more than two concurrent
composers on one block. Neither is expected to change the surface decision; both are `#42`
material if `#42`'s harness ever gets built.

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

### Writes never go through the `Block` view model

Restated because the surface is where it would be easiest to forget: `editBlockText` (or
whatever calls `yorkie.Text.edit()` under it) is the only way text changes, never an assignment of
a whole string over the field. `lib/blocks/types.ts` already says why — a `Block`'s `text: string`
is read-only shape, and assigning it back would erase whatever a peer typed at that moment instead
of merging with it.

## Open questions

- ~~Concurrent-move convergence on the pinned SDK version.~~ Closed by
  [Verification](#verification-2026-08-27) item 2, with two follow-up cases named
  there that were not covered.
- ~~The editing surface (rich text vs. plain textarea, IME handling).~~ Closed above,
  2026-08-30.
- Block/text color and styling (`AGENTS.md` §7).
