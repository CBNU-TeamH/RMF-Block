# Simple collaborative table blocks — lessons

**Created**: 2026-10-16

## What surprised us

- Cell text is nested: both event routing and revision snapshot flattening previously handled only scalar block text.
- Concurrent row and column creation can leave their intersection uninitialized; cell creation must merge rather than replace a shared object key.

## What we would do differently

- Exercise the concurrent-structure cases before polishing the UI: an uninitialized crossing uncovered a stored callback from spreading a richer binding object. Persist only explicit address fields.
- Test IME in repeated text, not just distinct prefixes. Inferring positions from final text repeats a previously fixed bug; route original operations and translate fragment offsets.
- A deterministic fallback must survive the next mutation. Adding after an all-tombstoned axis now promotes its visible survivor before inserting the new axis.
- Two-browser E2E needs the same care as the product: a UI edit is committed as a final-string diff, so inserting `a` into `aaa` "at 0" lands at the end. Assert what the operation did, and leave offset mapping to component tests.
- After each side deletes a different row, both views show one row before they converge. Wait for the same row ID on both sides before editing, or the edit goes into a row that is about to be hidden.

## Worth extracting

- No new global convention: S-5 already requires reusing the original text-operation path. The table design records fragment mapping and fallback promotion so this mechanism has one owner.
