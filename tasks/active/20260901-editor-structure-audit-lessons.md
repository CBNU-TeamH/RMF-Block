# Editor structure — audit and refactoring plan — lessons

**Created**: 2026-09-01

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **The compiler catches one of six places a new block type has to be handled.**
  Measured by adding a thirteenth type to the `Block` union and running
  `npx tsc --noEmit`: a single error, in `toStoredBlock`. `readBlock`'s
  `default: return null` silently *drops* the block, and three helpers in
  `editor.tsx` silently fall back. A `Record<BlockType, …>` is exhaustive where a
  `switch` with a `default` is not — the schema in
  `docs/design/document-editing.md` is only as real as the places that fail to
  compile without it.

## What we would do differently

- ...

## Worth extracting

- ...
