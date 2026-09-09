# Undo and redo — lessons

**Created**: 2026-09-08

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **The hardest part was one line in a subscription filter.** Undo publishes `local-change`, not
  `remote-change`, and `use-block-document` took only the latter — so `undo()` would have changed
  the document and left the screen alone. Everything downstream (op routing, `touchesBlockList`,
  the handler map, the rebuild fallback) was written for remote changes and needed nothing, because
  what it was really written for was *a change this component did not make*.

- **A decision made for other reasons made this feature possible.** The SDK guide lists undo/redo
  as supported for Text, object and array operations and says Tree support "is under development".
  `document-editing.md` §"Why an Array of blocks, and not one `yorkie.Tree`" chose the array on
  grounds that had nothing to do with history, and a document built on `Tree` could not have undo
  today.

## What we would do differently

- **Read the vendor's own guide before reading its source, not after.** The source gave the
  important thing (the stack is local-only) but missed three the guide states outright: `undo()`
  throws inside `doc.update()`, the redo stack clears on the next change, and Tree is unsupported.
  Source-reading answers "what does it do"; the guide answers "what may I not do".

- **A tab that has been reloaded thirty times is not a clean environment.** One tab began hanging
  its own `AttachDocument` while a Node client attached instantly and Yorkie sat at 2% CPU; a fresh
  tab was immediately fine. Twice now a browser symptom has been read as an app fault. **Open a new
  tab before diagnosing.**

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **Check the reference implementation for the edge, not the shape.** wafflebase's undo is four
  lines around `doc.history.undo()` — the same four anyone would write. What was worth taking was
  `undoFloor`, a guard against something it had hit and this had not: undoing past the document's
  own seed. Proposal for `AGENTS.md` §2's delegation note: when a sibling project solves the same
  problem, the value is usually in what it defends against, not in how it calls the API.
