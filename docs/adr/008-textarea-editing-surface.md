# ADR-008: A plain `<textarea>` per block, not a rich-text framework

- **Status**: Accepted
- **Date**: 2026-09-17
- **Related**: [ADR-007](007-block-array-not-tree.md) (the `Tree` limitation this decision is downstream of), issue #42, [`docs/design/document-editing.md`](../design/document-editing.md) "Editing surface"

## Context

A rich-text framework would buy real things here: Notion-style block movement and IME composition
handling for free. "We need block movement, so a rich-text editor is out" is not actually the
reason and is not even generally true — ProseMirror-based Notion-style editors (BlockNote, for
one) exist. The real blocker is specific to this stack: binding a rich-text framework's document
model to Yorkie makes it a `yorkie.Tree` (`@yorkie-js/prosemirror` binds ProseMirror to `Tree`),
and [ADR-007](007-block-array-not-tree.md) already ruled `Tree` out — its `move` operation is
unimplemented, and re-parenting a CRDT is silent data loss, not an error.

So the honest framing is a trade, not a simplification: this project takes on IME handling itself
in exchange for block movement that is safe under concurrent editing.

## Decision

A plain, **uncontrolled** `<textarea>` per text-bearing block, patched imperatively on the changed
range only. Not a rich-text framework. Not React's controlled `value={text}` binding either, even
though that looks like the obvious first thing to reach for.

## Alternatives considered

- **A rich-text framework (e.g. BlockNote/ProseMirror)** — rejected per [ADR-007](007-block-array-not-tree.md)'s
  `Tree` limitation. Adopting one now would also discard `lib/blocks/operations.ts`, already built
  and tested against the array shape ADR-007 settled on.
- **React's controlled `value={text}` binding** — tried and measured to corrupt text under
  concurrent editing, though not for the first-assumed reason. The sharper failure was a bug in
  the measurement harness itself: the local diff baseline ("what I last told Yorkie the text was")
  was not updated on the remote-render path, so the next local keystroke diffed against a stale,
  shorter string and reinserted the entire visible content as if new. Two people typing
  "안녕하세요" into the same empty block concurrently produced "안안녕녕하세요" — the whole
  greeting duplicated. The lesson generalizes past this one bug: any surface reading "the current
  text" from one source (React state) while diffing against a second, independently-updated source
  (a sync baseline) has to keep both in lockstep on *every* path that touches either — the remote
  path mutates "what Yorkie holds" exactly as much as the local path does.

## Measured evidence (2026-08-29–30, against a live two-client Yorkie 0.7.13 session)

- An uncontrolled textarea, patched only on the changed range, survives concurrent Hangul IME
  composition: remote edits arriving mid-composition are queued and flushed once
  `compositionend` fires, without the duplication failure above or the composition-interruption
  failure rich-text frameworks are built to avoid. Non-composing keystrokes sync per keystroke
  with no queuing needed.
- The SDK's own `EditOpInfo` carries exactly what patching needs — `{ from, to, value: { content },
  path }`, character offsets against the pre-edit string — including correct caret adjustment
  against a live remote edit.
- A composed syllable is one edit, not one per IME candidate, when composition is guarded
  (`compositionstart` suppresses per-keystroke syncing; `compositionend` commits the finished
  syllable as a single diff). The naive binding sent one edit per intermediate candidate, which
  would make Yorkie's own `doc.history.undo()` step back through IME candidates rather than
  through what a person thinks of as a character.

## Consequences

- IME composition handling, remote-change patch routing, and caret math are hand-built and owned
  in this codebase (`lib/blocks/text-surface.ts`) instead of inherited from a framework — the cost
  side of the trade this ADR takes on.
- Not yet measured: composition survival at a network delay long enough that several remote edits
  queue before `compositionend` fires, and behavior with more than two concurrent composers on one
  block. Neither is expected to change this decision; both are issue #42 material if its
  measurement harness is ever built.
