# Presenter pointer — lessons

**Created**: 2026-09-13

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **Deciding "presenter is read-only while pointing" collapsed the whole design.** The plan going
  in assumed the pointer would need its own input path — a container-level `mousemove` listener
  that stayed non-blocking, separate from the SVG's drag-capturing one, since a laser pointer
  conceptually shouldn't stop you from also clicking. Asking the one question that mattered
  (should clicking still work while pointing?) got a "no," and that single answer meant the
  pointer could reuse the *exact* capture the drawing tools already have — `onPointerDown` gained
  one guard line, `onPointerMove` gained one branch, `onPointerUp`/`onPointerCancel` needed zero
  changes. What looked like a second architecture was a third `if` on the first one.
- **React's newer purity rule caught a real one**: `Date.now()` called directly in a component's
  render body (to age trail points for display) is now a hard lint error
  (`react-hooks/purity`), not just bad practice — render has to be idempotent, and wall-clock time
  isn't. The fix (lift `now` to state, updated on the same prune interval, passed down as a prop)
  is more correct anyway: the previous ad hoc version would have re-read the clock on every
  unrelated re-render, silently drifting from what the trail's own prune timer was using.
- **The cost table from #95 aged out mid-project without anyone touching it.** "Publish only the
  current point keeps the pointer's payload O(1)" was true and unchanged — but it was written
  against a ~110-byte mark, and marks had since become paths up to ~125KB. The pointer's own
  number didn't need to move; the number it now sits *next to* did, and re-measuring rather than
  re-quoting the old figure is what caught that.

## What we would do differently

- Ask the read-only question *before* drafting anything, not after a first architecture pass. It
  was asked first this time (informed by the last task's pattern of costly rework from an
  unstated assumption), and the payoff was immediate — the whole "non-blocking container listener"
  design never got written.

## Milestone 6: a real bug found by describing a hypothetical, and a scope call reversed

Manual testing prompted a "what if multiple people share at once — wouldn't the dashboard error?"
question. It doesn't (verified: the dashboard never reads presence state, and every focus/ink DOM
query is either unreachable outside `/documents/[id]` or null-guarded) — but chasing the question
down anyway found a real, different bug: `FocusShare`'s `members.find(...)` picked one presenter
arbitrarily, silently hiding every other simultaneous one from every viewer, everywhere. Nobody
had reported this because triggering it requires two people presenting at once, which the SRS's
singular phrasing ("발표자가") never anticipated as a scenario worth writing a branch for. The
question that surfaced it wasn't really about crashes; the crash-shaped worry was the trigger for
looking, not the actual finding.

**The scope call**: the fix touches `focus-share.tsx`, unrelated to the pointer feature this
branch owns. The default (AGENTS.md §6, one task per branch) is a separate issue, and that's what
got planned first. The user then explicitly asked for it in this same PR instead — overriding
that default is their call to make, not something to re-argue once said twice
(`AGENTS.md`/system instructions on this). Recorded here so the "why is an unrelated file in this
diff" question has an answer without needing to ask.

**The fix stayed deliberately smaller than the design already on file.** `docs/ui/app-shell/app-shell.jsx`
sketches a full multi-presenter card-grid UI; what shipped is a `<select>` dropdown that only
appears once there are actually two or more. Reaching for the fuller design would have been
scope creep on top of scope creep — the dropdown makes every presenter *reachable*, which is the
actual bug, without also redesigning a header control that generally shows zero or one of
anything.

## Worth extracting

- **`docs/conventions.md` candidate**: revisit a cost claim when the thing it's *adjacent to*
  changes shape, not only when the thing itself does. `MAX_POINTS_PER_MARK`'s comment already
  covers marks; the pointer's own #95 citation ("O(1) payload") needed no correction, but reading
  it next to the *other* number it now rides alongside is what surfaced that the combined story
  had gone stale. This is the same shape as
  [`20260912-presenter-marks-lessons.md`](20260912-presenter-marks-lessons.md)'s note about
  `MARK_CAP`, now the second occurrence.
