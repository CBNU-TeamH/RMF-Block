# Delete a whole-block selection — lessons

**Created**: 2026-11-18

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- Deleting every block and then re-making the trailing block with `ensureTrailingEmptyBlock` is two `doc.update`s, so two undo steps; the first undo removes the block holding the caret and the document is left with nothing to type in. Doing both in one update makes it one step.
- Inside that update the array can be momentarily empty, and `root.blocks[root.blocks.length - 1]` then throws `YorkieError: out of index: tree size 0, index -1` instead of returning `undefined` — the whole update rolls back and the delete silently does nothing. The first E2E run caught it.

## What we would do differently

- ...

## Worth extracting

- ...
