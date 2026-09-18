# Architecture detail and guided story — lessons

**Created**: 2026-09-18

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- `meta.views` alone defines Story chapters, but `meta.animation: "trace"` is what exposes the
  reader's Live / Still motion control and makes playback visually explicit.
- A useful Story needs ordered directly connected nodes; a focus set with unrelated adjacent nodes
  is valid but reads like grouped highlights rather than a runtime path.

## What we would do differently

- Separate the app-owned path from Yorkie's admin/webhook path in cards when both directions would
  force several secondary edges through the main diagram corridor.
- Start the detailed map with short node context labels; 12 nodes made one long Yorkie SDK label
  fall just below the 1440px projected-text threshold.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing yet. The Story authoring observations are Archify-specific rather than repository-wide.
