# Editor structure — audit and refactoring plan

**Created**: 2026-09-01
**Issue**: none yet — this doc is the proposal. Related: #39 (no component tests).
**Design**: [`docs/design/document-editing.md`](../../docs/design/document-editing.md) is the
schema this audits against. No new design doc: nothing here changes the block model or the
storage shape, only where the code that uses them lives.

Three questions, asked of `app/(workspace)/documents/[id]/editor.tsx` and its neighbours:
what should be **modularized**, what should be **refactored**, and what should be **improved** —
each judged by one standard, *what does it cost to extend this?*

Nothing here is implemented. Every claim below is measured, and the command that measured it is
given, so a reviewer can disagree with the conclusion without re-deriving the facts.

## The shape of the problem

`editor.tsx` is one component, and it has roughly doubled with each feature that touched it:

| after | lines | |
| --- | --- | --- |
| `#51` block editor | 718 | create/edit/split/merge/reorder |
| `#54` PDF block | 913 | + upload, drop, delete, a second renderer |
| `#58` focus following | 1176 | + presenter publish, follower scroll |

```bash
for c in 851f7d4 81d3bd1 3865ab8; do git show "$c:app/(workspace)/documents/[id]/editor.tsx" | wc -l; done
```

That is not by itself a defect — the file is unusually well commented and each addition was
locally reasonable. It matters because of *what* is now interleaved. Six concerns share one
function body and one closure:

| lines | concern | coupled to the rest by |
| --- | --- | --- |
| 223–324 | Yorkie attach / seed / subscribe / teardown | `docRef`, `setBlocks` |
| 355–473 | focus following: publish anchor, follow anchor | `scrollContainerRef`, `blocksLoaded` |
| 493–800 | block mutations (split, merge, navigate, markdown, checklist, delete) | `docRef`, `blocks`, `setBlocks` |
| 804–866 | PDF upload | `documentId`, the same mutation envelope |
| 870–930 | drag-and-drop reorder | `blocks`, `setBlocks` |
| 940–1176 | render, focus restoration, the footer | everything |

The couplings are narrow: `docRef`, `blocks`/`setBlocks`, and two DOM refs. That is what makes
the extractions below cheap — the seams already exist, they are just not drawn.

---

## 1. Modularization

### M1 — The one extensibility defect worth fixing first: there is no block-type registry

**Measured.** Add a thirteenth type to the `Block` union and ask the compiler what breaks:

```bash
# add `CalloutBlock` to the union in lib/blocks/types.ts, then:
npx tsc --noEmit
# lib/blocks/document.ts(203,46): error TS2366: Function lacks ending return statement…
```

**Exactly one error**, in `toStoredBlock`. Everything else compiles and then silently does the
wrong thing:

| place | what it does with an unknown type | how you find out |
| --- | --- | --- |
| `document.ts` `readBlock` | `default: return null` — the block is **dropped from the document** | it vanishes on screen |
| `editor.tsx` `isTextBearing` | returns `false` | no editing surface |
| `editor.tsx` `variantOf` | `default: { type: "text" }` | wrong styling |
| `editor.tsx` `continuationBlock` | falls through to plain text | Enter behaves oddly |
| `editor.tsx` render chain | the `아직 편집할 수 없는 블록입니다` branch | visible, at least |

So the flow for the next person adding the image block (FR-022-14's second leg, already
half-specified) is: fix the one error the compiler names, then discover the other five by
running the app. `docs/design/document-editing.md` describes twelve types as a settled schema;
the code only enforces one of them.

**Proposal.** One `Record<BlockType, …>` keyed by the union, the way `document.ts` already does
it — a `Record` over a union is exhaustive, so a missing key is a compile error rather than a
runtime fallback.

```ts
// lib/blocks/registry.ts — data, not components, so it stays testable and
// importable from anywhere.
type BlockKind = {
  /** Edits through TextBlockView's one <textarea>. Replaces `isTextBearing`. */
  textBearing: boolean;
  /** What Enter leaves behind. Replaces `continuationBlock`. */
  continuation: (block: Block) => Block;
};
export const BLOCK_KINDS: Record<BlockType, BlockKind> = { … };
```

and, in the component layer, the render dispatch as a record rather than a ternary chain:

```ts
// editor.tsx
const RENDERERS: Record<BlockType, (props: BlockRowProps) => ReactNode> = { … };
```

**Two invariants the registry must not break**, both learned the hard way and both documented
in the code today:

- `TextBlockView`'s returned root stays a bare `<textarea>` in every variant. A conditional
  wrapper changes the root element across a type conversion and React remounts it — measured as
  a lost cursor (`text-block.tsx`, `BlockVariant`'s doc comment).
- The marker slot (bullet / number / checkbox) stays a *fixed* sibling `<span>`, present or
  empty, so `TextBlockView`'s position among its siblings never shifts (`editor.tsx`, the
  "fixed two-slot row" comment).

A registry that returns whole rows would make both easy to violate. So the registry should
supply the *marker* and the *variant*, not the row.

**Cost**: one new file, three helpers deleted, one ternary chain replaced. **Payoff**: adding a
block type becomes "the compiler names every place", which is the difference between a
half-hour and an afternoon for each of the four types still unimplemented.

### M2 — Three hooks, in this order

Not one hook per handler. The mutation handlers genuinely share `blocks` and the edit envelope,
and splitting them would buy indirection and nothing else. But three groups have no coupling to
the rest beyond two refs:

1. **`useBlockDocument(client, documentId)` → `{ blocks, setBlocks, failed, docRef, registerRemoteHandler }`**
   (lines 223–324, ~100 lines). The attach/seed/subscribe/teardown machinery, including the
   Strict-Mode teardown chaining that took a measured bug to get right. It reads nothing from
   the rest of the component. Extracting it is a move, not a rewrite — and it puts the hardest
   100 lines in the file behind a five-field contract.
2. **`useFocusPresence({ documentId, containerRef, blocksLoaded })`** (lines 355–473, ~120
   lines). Two effects, both already backed by pure, tested functions in `lib/focus/`. Only the
   effects live in the component, and they touch nothing else.
3. **`usePdfUpload(documentId, applyEdit)`** (lines 804–866) → `{ uploading, uploadError, upload }`.
   Naturally separate the moment `applyEdit` (R1) exists.

After all three, `editor.tsx` is ~600 lines and reads as "hold the blocks, wire the handlers,
render the rows" — which is what it is.

**Where they live**: `app/(workspace)/documents/[id]/` beside the component, not `lib/`. They
are React and they are DOM-bound; `lib/` in this repo is pure logic with `node --test` coverage
(`AGENTS.md` §4), and putting hooks there would break that promise.

---

## 2. Refactoring

### R1 — `applyEdit`: the same envelope, ten times

**Measured** in `editor.tsx`:

```bash
grep -c "const doc = docRef.current" editor.tsx              # 10
grep -c "setBlocks(readBlocks(doc.getRoot().blocks))" editor.tsx  # 10
grep -c "instanceof BlockNotFoundError" editor.tsx           # 6
```

Every mutation is the same twelve lines with three lines of difference:

```ts
const doc = docRef.current;
if (!doc) return;
try {
  doc.update((root) => { /* the actual operation */ });
} catch (error) {
  if (error instanceof BlockNotFoundError) return;   // "a peer removed it first"
  throw error;
}
setBlocks(readBlocks(doc.getRoot().blocks));
```

Six of the eight mutation sites catch `BlockNotFoundError`; the two that do not
(`ensureTrailingEmptyBlock`, and the upload's insert) provably cannot throw it — one only
pushes, the other checks `liveBlockOf` first. That reasoning is currently nowhere.

**Proposal:**

```ts
/** Runs one mutation against the live document and republishes the block list.
 *  Returns false when there was nothing to run against — no document yet, or a
 *  peer removed the block this edit named before it arrived, which is that
 *  peer's operation standing rather than an error to report. */
const applyEdit = (mutate: (root: BlockDocumentRoot, blocks: BlockArray) => void): boolean
```

Each handler then states its operation and nothing else — `handleToggleChecklist` goes from 22
lines to 6. The "a peer got there first" rule is written once, with its reason, instead of six
times.

### R2 — `handleDrop` does two unrelated jobs and carries a parameter to prove it

`handleDrop(event, targetId, forcedBefore?)` branches on whether the drag carries files or a
block id, and the third parameter exists only because one of its three callers (the footer) is
not a block and cannot answer "before or after?" about itself.

**Proposal**: two functions — `dropFilesAt(files, afterId)` and `moveBlockTo(draggedId, destination)`
— with the three DOM handlers deciding which to call. The `forcedBefore` parameter disappears
because the footer simply passes the destination it already knows.

### R3 — `order` is recomputed five times

`blocks.map((b) => b.id)` appears at lines 665, 725, 746, 901, 942. It is cheap, but it is also
the *same* value five times, and two of the call sites are inside handlers that already receive
`blocks`. One `useMemo` at the top, passed down. Trivial; listed because it is free.

### R4 — Per-type helpers move into the registry

`isTextBearing`, `variantOf` and `continuationBlock` are three hand-maintained lists of the same
twelve types. They are M1's content, not separate work — noted so the refactor does not leave
them behind.

---

## 3. Improvements

### I1 — Pull the remaining decisions out of the effects and test them

This repo's strongest existing habit is that decisions live in pure functions under `lib/` with
`node --test` coverage — `anchor.ts`, `reorder.ts`, `markdown-shortcuts.ts`, `text-surface.ts`
are all this. The subscribe callback is the one place that broke the habit:

```ts
if (op.path === "$.blocks" || op.path.startsWith("$.blocks.")) needsRecompute = true;
```

That predicate decides whether a peer's change is visible at all, it has three known-tricky
cases already written up in a comment beside it (array ops, a conversion's `set` on
`$.blocks.<i>`, and `content`-level sets), and it has **no test**. `blockIndexFromEditPath`, two
lines above it, does. Extracting `touchesBlockList(path)` next to it costs nothing and closes
the gap.

More generally: #39 says there are no component tests, and every bug listed in #58's own
description was invisible to unit tests and to a single-tab check. The extractions in M2 do not
fix that on their own, but they are what makes it approachable — a hook with a five-field
contract can be exercised; a 1176-line component cannot.

### I2 — The upload seam is PDF-shaped, and the next two legs are already specified

`uploadPdfs` names its type in the function name, the endpoint, the `accept` attribute and the
error message. FR-022-14 wants image and generic-file blocks through the same drop and the same
picker. The seam that generalises is small and worth drawing when the second type lands, not
before: `upload(files) → StoredFile[]`, then `blockFor(stored)` choosing the factory by type.
Listed here so whoever adds the image block reaches for it instead of copying `uploadPdfs`.

### I3 — Every block re-renders whenever the drop indicator moves

`setDropIndicator` is component state, so a drag across a long document re-renders the whole
list each time the insertion line moves. `showIndicator` already dedupes identical values, so
this is once per crossed boundary rather than once per `dragover` — but with the 120-block
document used to test focus following, that is still 120 rows rebuilt per crossing.

**Worth measuring before touching.** React may well absorb it; the rows are cheap and
`TextBlockView` is uncontrolled. If it does show up, the fix is a memoized row with the
indicator passed as a per-row prop, or moving the line to CSS driven by a data attribute on the
container. Do not memoize speculatively — that trades a real cost (stale closures in handler
props) for a hypothetical one.

### I4 — Two representations of a block's text, and only a comment keeps them apart

`blocks[i].text` is a snapshot from the last recompute; the live `yorkie.Text` is the truth, and
`liveTextOf` exists because the snapshot goes stale the moment anyone types. Every handler that
reads text has to remember which one it wants. This is correct today and carefully explained,
but it is the trap most likely to catch the next contributor.

No proposal — the honest options are both worse than the status quo (dropping `text` from the
read model breaks the initial render; making the textarea controlled is exactly what
`text-block.tsx` measured as corrupting). Recorded so that the M1/M2 work does not quietly make
it easier to reach for the wrong one.

---

## Not worth doing

Listed because "no over-engineering" (`AGENTS.md` §3.2) applies to refactors too, and each of
these came up while auditing:

- **A state-management library.** The state here is one array and four flags; `useState` is not
  the problem.
- **A repository/service interface over Yorkie.** `lib/blocks/operations.ts` is already that
  seam, and it is a good one — id-addressed, transaction-free, tested.
- **A hook per handler.** Indirection with no boundary behind it.
- **Splitting `text-block.tsx`.** At 323 lines it holds exactly one thing: the editing surface.
- **Renaming `editor.tsx` to a folder of files without extracting the concerns first.** Moving
  code between files is not modularization.

## Suggested order

Each step leaves the tree green and is independently reviewable.

| | step | why here | risk |
| --- | --- | --- | --- |
| 1 | **R1** `applyEdit` | mechanical, shrinks every later diff | low |
| 2 | **R3** `order` memo | free, rides along with R1 | none |
| 3 | **M1** block-type registry | the extensibility payoff; do it while the handlers are still in one file | medium — touches the render tree, and the two remount invariants are easy to break |
| 4 | **M2.1** `useBlockDocument` | biggest single lift out, no behaviour change | medium — Strict-Mode teardown must survive the move |
| 5 | **M2.2** `useFocusPresence` | same, and #58 is fresh enough to re-verify against | low |
| 6 | **I1** `touchesBlockList` + test | small, closes a real coverage hole | none |
| 7 | **M2.3** `usePdfUpload`, **R2** drop split | last, because they are the smallest | low |
| — | **I2**, **I3**, **I4** | not now: I2 lands with the image block, I3 needs a measurement first, I4 is a note | — |

## Acceptance

For whichever steps get approved:

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` pass at every step, not just at the end.
- [ ] **No behaviour change.** Verified the way #58's own bugs were found, because unit tests
      did not find them: two clients on one document, and the checks each PR already listed —
      split/merge/reorder, markdown shortcuts, a PDF block dropped and deleted, a presenter
      followed across a document switch.
- [ ] Adding a thirteenth type to the `Block` union fails to compile **in every place that has
      to handle it**, not just `toStoredBlock`. That is M1's whole point and is testable by
      doing it and reading the errors.
- [ ] `editor.tsx` under ~600 lines, with no concern in it that is not "hold the blocks, wire
      the handlers, render the rows".

## Review

**Done: R1, R3, M1, M2, I1.** R2 is deliberately not done — see below.

| | | |
| --- | --- | --- |
| R1 | `applyEdit` | 8 mutation sites through one envelope. Before: 10 × the `docRef` guard, 10 × `setBlocks`, 6 × `catch BlockNotFoundError`. After: 4 (all reads), 3 (initial load, remote change, local edit), 1. `handleToggleChecklist` 17 → 5 lines |
| R3 | `order` | memoized once; five rebuild sites gone |
| M1 | `lib/blocks/registry.ts` | `BLOCK_KINDS`, `isTextBearing`, `continuationBlock`, + 10 tests |
| M2 | three hooks | `use-block-document.ts` (161), `use-focus-presence.ts` (223), `use-pdf-upload.ts` (117) |
| I1 | `touchesBlockList` | the last decision still inline in an effect, now beside its tested sibling + 4 tests |

`editor.tsx`: **1176 → 823 lines.**

### The acceptance criterion that mattered

> Adding a thirteenth type to the `Block` union fails to compile in every place
> that has to handle it.

Before, one error. After, five — the table, `readBlock`, `toStoredBlock`,
`variantOf`, and the render dispatch. The two `default` branches that must stay
for runtime resilience (the LAN can write a type this build has never heard of)
now carry a `never` guard, which separates that case from "a type we forgot".

TypeScript was stricter than the plan assumed, twice, and both were improvements:
a `case "text"` in the surface switch is *rejected* as unreachable, because
`Kind` ties "carries text" to `surface: "text"`; and narrowing does not survive a
repeated property access, so the surface has to be bound to a const first.

### Verified

`pnpm lint`, `pnpm test` (331), `tsc --noEmit`, `pnpm build` — green after each
step. Behaviour checked against a real Yorkie stack, because none of this is
reachable from unit tests: nested-list continuation keeps style and depth, an
empty list item exits to text on Enter, Backspace-at-start merges, and a block
pushed by a separate Node client appears live.

### R2, and why it is being left alone

Splitting `handleDrop` was on the list and is not worth doing. It is tidiness:
the function works, and `forcedBefore?` is a smell rather than a defect. Against
that, it is drag-and-drop — the one area here whose bugs are invisible to the
type checker and to `node --test`, and findable only by dragging things around a
browser by hand. Paying that verification cost to remove one optional parameter
is a bad trade. It should ride along with the next change that has to touch drop
handling for its own reasons.

The same reasoning retires I2 (waits for the image block), I3 (needs a
measurement first) and I4 (a note, not a task). **This plan is finished.**

### Two things the click fix added afterwards

Not in the original audit — they came out of using the editor rather than
reading it:

- Clicking the empty space under the document now puts the caret at the end of
  it, making a new trailing block if the document ends in something that cannot
  hold one. `ensureTrailingEmptyBlock` returns the block it guarantees so the
  caller knows where to put the caret.
- That space shows an I-beam, so the target is visible before it is clicked.

### Found while verifying, not caused by it

Both A/B-confirmed against `3865ab8` on the same stack:

- **#59** — split and merge leave the surviving textarea showing stale text.
- A block a peer adds *and then writes into* arrives with an empty textarea: the
  `edit` op is routed to a handler the new row has not registered yet. Same root
  design as #59, noted there.
- A tab that once failed to connect never recovers without a fresh tab (**#37**).
