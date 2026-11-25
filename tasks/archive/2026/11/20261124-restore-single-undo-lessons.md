# Undo a version restore in one Ctrl+Z — lessons

**Created**: 2026-11-24

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- "A `yorkie.Text` cannot be edited before it is in the tree" was true and still read as "needs a second update". Re-reading `root.blocks` inside the same callback gives the in-tree node, so one update is enough.


## What we would do differently

- Spike a CRDT claim with a side-by-side test (old shape vs new shape) before planning a workaround; it took minutes and removed the undo-stack fallback from the plan.


## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing yet.

