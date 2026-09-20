# ADR maintenance: fix a cross-reference gap, add 4 new ADRs — lessons

**Created**: 2026-09-17

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- ADR-001 and ADR-002 got a proper retroactive Status update when ADR-002 superseded part of
  ADR-001. ADR-003 → ADR-004's supersession never got the same backward-edit — ADR-004's own
  header says it supersedes ADR-003 Decision 4, but ADR-003 itself was silent about it. The
  convention exists; it just wasn't applied consistently the second time.
- Most of the "new" ADR content required no new research at all. `docs/design/chat.md` and
  `docs/design/document-editing.md` already contained fully-argued, evidence-backed cases
  (including dated measurement spikes) for decisions that had simply never been promoted to
  `docs/adr/`. The work was almost entirely reorganizing existing prose into the ADR template,
  not producing new reasoning.

## What we would do differently

- Check an open PR's own diff *before* planning a "just add a pointer" edit near text that PR
  touches. The plan called for a bare one-line pointer in `chat.md`; PR #107's diff (checked
  beforehand) already rewrites that exact paragraph, so the pointer became a short addendum
  instead of a rewrite, to avoid landing a competing edit on the same lines.

## Worth extracting

- When a later ADR supersedes part of an earlier one, update the earlier ADR's Status line at
  the same time (per ADR-001's pattern) — don't rely on the later ADR's own header to carry the
  cross-reference alone, or it silently goes one-directional.
