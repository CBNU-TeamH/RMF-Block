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

- **A controlled `<textarea>` broke worse than expected, and the worse half was our own bug, not
  React's.** Step 0's spike (`app/(workspace)/spike/ime-harness/`) diffed local keystrokes against
  a `lastSyncedRef` baseline that the remote-edit path forgot to update. Two clients typing
  "안녕하세요" into the same empty block concurrently produced `"안안녕녕하세요"` — the whole
  string reinserted on top of itself, repeatedly. **Any surface reading "current text" from one
  source while diffing against a second, independently-updated baseline has to advance both on
  every path that touches either** — the remote path mutates "what Yorkie holds" exactly as much
  as the local path does. Fixed by updating the baseline in the remote handler too; see
  `document-editing.md`'s "Editing surface" §"What was measured" for the rest of what Step 0 found
  (an uncontrolled textarea patched by range, with composition guarded and flushed on
  `compositionend`, held up under the same test).

## What we would do differently

- ...

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- ...
