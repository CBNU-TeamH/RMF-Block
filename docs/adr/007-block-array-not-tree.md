# ADR-007: Blocks are a flat Yorkie `Array`, not a single `yorkie.Tree`

- **Status**: Accepted
- **Date**: 2026-09-17
- **Related**: [ADR-001](001-realtime-sync.md) (Decision 1 — no custom merge logic), [ADR-008](008-textarea-editing-surface.md), [`docs/design/document-editing.md`](../design/document-editing.md) "Why an Array of blocks, and not one `yorkie.Tree`" and its 2026-08-27 Verification section, issue #42, [yorkie-team/yorkie#676](https://github.com/yorkie-team/yorkie/issues/676)

## Context

The reference project this codebase borrows patterns from, [wafflebase](https://github.com/wafflebase/wafflebase),
stores a whole document editor as a single root-level `yorkie.Tree` — a natural fit for its own
word-processor-style hierarchy (`doc > table > row > cell > paragraph > inline > text`) and its
inline formatting, which `Tree.style(from, to, attrs)` expresses directly.

This project's schema — `root.blocks: Array<Block>`, each block a flat object with a stable `id`
— was chosen without that comparison being written down at the time. This ADR records it after
the fact, drawing on `docs/design/document-editing.md`'s own reasoning and a dated measurement
spike run against the pinned SDK.

## Decision

`root.blocks` is a Yorkie `Array` of flat block objects, not a `yorkie.Tree` hierarchy. Order is
the array position itself (Yorkie's `Array` is RGA-backed, so concurrent inserts at the same
position converge deterministically); reordering uses the array's native `moveBefore`/`moveAfter`,
per [ADR-001](001-realtime-sync.md)'s "no custom merge logic."

## Alternatives considered

- **A single root `yorkie.Tree`, as wafflebase uses** — rejected, for reasons specific to this
  project's requirements rather than a general critique of `Tree`:
  - SRS asks for no inline formatting. "Plain text, no inline marks" is the requirement, not a
    simplification chosen — `Tree`'s biggest advantage over `Array` is unused here.
  - Six of the twelve block types hold no text at all (divider, file, image, PDF, the two link
    blocks). As tree nodes they are attribute-only leaves — a shape `Tree` tolerates rather than
    serves.
  - FR-022-06 and the block-link block both need a stable per-block id; an array element with an
    `id` field gives that directly.
  - **`Tree.move` is not implemented.** `packages/sdk/src/document/crdt/tree.ts` throws
    `ErrUnimplemented`. FR-022-04 (block reordering) is a hard requirement, and the only way to
    reorder a tree today is delete-and-reinsert — which mints new node ids, so a peer's concurrent
    edit to the moved block lands on the deleted node and is lost. `CRDTArray.moveAfter` keeps the
    element and moves only its position.

## Measured evidence (2026-08-27, against `yorkieteam/yorkie:0.7.13` on `mongo:8`)

- **A `yorkie.Text` nested in an array element is a live CRDT, not silently serialized to inert
  JSON.** wafflebase's own code carries a warning that a `yorkie.Tree` nested inside an array
  element serializes to plain JSON on that SDK version — reads see an inert object, writes
  silently no-op. Checked directly at this depth: a second client attaching to an existing
  document receives a working `Text` with `edit()`, concurrent character-level edits from two
  clients converge with both present, and a cold third client reads the merged result. The warning
  does not reproduce here.
- **Concurrent `moveAfter` converges where [yorkie-team/yorkie#676](https://github.com/yorkie-team/yorkie/issues/676)
  said it might not.** Two clients each moved a block past the block the other was moving — each
  side's reference element was the other's moved element. Both converged on the same order, no
  block was lost, and a cold third client agreed.
- **A move preserves the moved block's text, including a peer's concurrent edit.** One client
  moved a block to the end of the document while another typed into that same block; the order
  converged and the typed characters survived. This is the property `Tree` cannot offer while
  `move` is unimplemented.
- **A CRDT cannot be re-parented, and failing to do so is silent.** Assigning an existing
  `yorkie.Text` into a newly-created object under the same document raised no error, produced a
  `Text` at the destination, and that `Text` was empty — the original characters were not carried
  over, with no exception marking their loss.

**Re-measured on `0.7.23` (2026-09-22), the first version bump since.** Both load-bearing
properties above still hold: a move with a peer typing into the moved block converged on both
clients with the edit intact, and re-parenting a `yorkie.Text` still produced an empty `Text` with
no exception. Ten releases — including 0.7.18's "anchor Array.Add on the last node's position
identity" — changed neither. Run by hand from a throwaway probe, which is the whole point of
issue #42: nothing in CI would have told us.

## Consequences

- **This choice is what makes undo/redo available at all today.** Yorkie's own guide lists
  undo/redo as supported for Text, object, and array operations, and states Tree support is
  "under development." A document built on `yorkie.Tree` could not have this feature yet — an
  unplanned dividend of a decision made for unrelated reasons.
- **The verification numbers above are load-bearing and unprotected by CI.** They are why every
  block's text is wrapped in `content.text` and why blocks are an `Array` rather than a `Tree`. A
  future SDK version could change either behavior with nothing in CI to say so; committing the
  measurement harness is tracked as issue #42.
- Everything that crosses a block boundary — splitting a block on Enter, merging on Backspace,
  selecting across blocks — is ours to build, and nesting is flattened to a `depth` number rather
  than a real parent-child relation.

## What this ADR does not claim

This is recorded after the fact, in `docs/design/document-editing.md`'s own words: "the structure
above was chosen without this comparison written down." The array shape predates the comparison
and the 2026-08-27 verification spike; both exist to check a decision already made, not to make
it. If a teammate remembers the array being chosen for a different or additional reason, theirs is
the record and this document should be corrected.
