# Open a document and edit it together — lessons

**Created**: 2026-08-29

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **`yorkie.Tree` has no move operation at all, and `yorkie.Array` has five.** Counted in the
  0.7.14 source: `document/json/array.ts` exposes `moveBefore`, `moveAfter`, `moveAfterByIndex`,
  `moveFront` and `moveLast`; `document/json/tree.ts` exposes none. That, not any limitation of
  rich-text frameworks, is why ProseMirror is out — its Yorkie binding is Tree-shaped, and
  FR-022-04 would become delete-then-recreate, which `document-editing.md`'s Verification item 4
  measured as silently losing the text.

## What we would do differently

- ...

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- ...
