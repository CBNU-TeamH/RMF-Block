# Ctrl+Z: undo and redo, per person

**Created**: 2026-09-08
**Issue**: none — no FR covers undo. It is the key everyone presses first and nothing happens today.
**Design**: [`docs/design/document-editing.md`](../../docs/design/document-editing.md) — this task adds "Undo is per person, and it is Yorkie's".

## What the SDK actually gives us, checked before designing

`@yorkie-js/sdk@0.7.13` exposes `doc.history` with `canUndo`/`canRedo`/`undo`/`redo`. Three things
were read out of the source rather than assumed, because each one decides the design:

1. **The undo stack is per client.** `pushUndo` is reached only from the local `update()` path,
   immediately after `localChanges.push(change)`; remote changes arrive through
   `applyChanges(…, OpSource.Remote)`, which never touches it. So `undo()` reverts *this browser's*
   last edit and never a peer's — which is the only version of undo that is correct in a shared
   document, and the reason this can be Yorkie's job rather than something built here.

2. **Undo publishes `local-change`, not `remote-change`**, carrying `source: OpSource.UndoRedo`.
   That is the whole problem: `use-block-document` subscribes to `remote-change` only, on the
   reasoning that "a local edit is the caller's to apply and republish" — and an undo has no
   caller to do that. Without handling it, `undo()` would change the document and leave the screen
   as it was.

3. **The stack is capped at 50** (`MaxUndoRedoStackDepth`). Worth knowing rather than discovering:
   the 51st edit silently drops the oldest, so undo is not a journey back to the empty document.

## Milestones

### 1. The subscription handles an undo's own event

- **What**: `use-block-document` reacts to `local-change` when its source is `UndoRedo`, taking the
  same path a remote change already takes — rebuild the block list, route text edits to the block
  that owns them.
- **Files**: `app/(workspace)/documents/[id]/use-block-document.ts`.
- **Reuse**: everything. The op-routing loop, `touchesBlockList`, the per-block handler map and the
  rebuild fallback were written for remote changes and are exactly what an undo needs — an undo is
  a change this component did not make, which is the property the existing code was written for.
- **Done**: calling `doc.history.undo()` from the console redraws the editor.

**Why this is not "treat it as remote".** The two are the same *to this component* and different to
the document: a remote change is another actor's, an undo is this actor's, and only the second can
be followed by `redo()`. The subscription cares about one thing — that nothing local is holding the
new text — so it takes both, and nothing else in the file learns the difference.

### 2. The keys

- **What**: `Ctrl/Cmd+Z` undoes, `Ctrl/Cmd+Shift+Z` redoes, from anywhere in the editor.
- **Files**: `app/(workspace)/documents/[id]/editor.tsx`, `text-block.tsx`.
- **Reuse**: `text-block.tsx` already owns a keydown handler with the composition guards.
- **Done**: typing, then Ctrl+Z, leaves the text as it was before that edit — in the document and
  on screen.

**The browser's own undo has to be stopped.** A `<textarea>` keeps its own edit history, and
Ctrl+Z inside a focused one would rewind the DOM while Yorkie kept the text — the same class of
desync `#59` was about. `preventDefault` on the keydown is what makes this file's undo the only
one.

### 3. What a stale baseline does to it

- **What**: after an undo, the block's `lastSyncedRef` has to agree with the text now in it.
- **Files**: `text-block.tsx`.
- **Reuse**: `patchRange` already resets `lastSyncedRef` — the remote path proves the shape.
- **Done**: undo, then type; the next keystroke diffs against what is really there, not the text
  before the undo.

## Acceptance

- [ ] `pnpm test`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build`, `pnpm verify:docs` clean.
- [ ] Browser: type into a block, Ctrl+Z, the characters go; Ctrl+Shift+Z, they come back.
- [ ] Browser: split a block with Enter, Ctrl+Z, one block again.
- [ ] **Two browsers**: A types, B types, A presses Ctrl+Z — only A's edit is undone.
- [ ] After an undo, the next keystroke does not corrupt the text (the `#59` shape).

## Cross-cutting

- **No FR**: nothing in the SRS asks for undo. Recorded as a Notion-parity feature, not a
  requirement, so it claims no traceability id it has not earned.
- **Docs**: `document-editing.md` gains the three SDK facts above — they are not derivable from
  this repo's code and cost source-reading to establish.
- **`use-block-document`'s own header** says the subscription reacts to `remote-change` only. That
  sentence becomes false here.

## Review

**Shipped**: all three milestones, plus a floor the plan did not have.

| | |
| --- | --- |
| `use-block-document.ts` | takes `local-change` with `source: "undoredo"`; owns `history()` and the floor |
| `text-block.tsx` | `Ctrl/Cmd+Z` / `+Shift+Z`, before every other key, with `preventDefault` |
| `document-editing.md` | "Undo is per person, and it is Yorkie's" |

**The plan's milestone 3 needed no code.** An undo's text-edit op reaches the block through the
same `registerRemoteHandler` a remote edit does, and `patchRange` already resets `lastSyncedRef`.
Reusing the remote path carried the baseline for free — verified, not assumed: after an undo, typing
`ABC` left the document holding exactly what the screen showed.

**Verified in the browser:**

| | |
| --- | --- |
| Type, `Cmd+Z` | the last edit goes |
| `Cmd+Shift+Z` | it comes back exactly |
| Undo, then type | screen and document agree — no `#59` desync |
| **A peer writes, then I undo ten times** | **the peer's text survives, only mine goes** |

The last row is the one that matters, and it is confirmed from both sides: the browser showed
`[피어글]` intact, and the peer's own client read the same.

**What wafflebase changed**: its docs store keeps an `undoFloor` — the stack depth at load — because
"undoing past it would destroy blocks the cursor still references". Measured here, our seed
(`root.blocks = [...]`, a root assignment) produces **no reverse operation at all**, so the stack is
empty at that point and the hazard does not exist today. That is an accident of which operation the
seed happens to use, not a design, so the floor went in anyway — three lines that say what is meant.

**What the SDK guide added** that source-reading had not: `undo()` throws if called inside a
`doc.update()` callback (nothing here does, and it is now written down because the two would be
easy to combine later); the redo stack clears on the next new change; and **`yorkie.Tree` has no
undo support yet** — so the array-of-blocks decision made for unrelated reasons is what makes this
feature possible at all.

**Cut**: nothing.

**Not verified**: undo of a *block* operation across two clients — one browser splitting a block
while another undoes. Text-level concurrency is covered above; the block-array case would need two
real browsers, and one tab in this session accumulated enough Yorkie clients over ~30 reloads to
start hanging its own attach. A fresh tab was fine; worth knowing before blaming the app.
