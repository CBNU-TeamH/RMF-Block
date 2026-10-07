# User location tracking — lessons

**Created**: 2026-10-07

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The first design passed every by-hand check and was still wrong: the user meant the header to show who is *here* and the tree to be where you go to people. Text decisions ("show a tag when 2+ are in it") read fine and hid that.
- `activeBlockId` cannot be a jump target: it is cleared on blur and ages out after 30s. The block had to be published again on the workspace presence, deliberately not cleared on blur.
- A `pgrep -f "git push"` wait loop never ends — it matches its own command line. Wait on a marker file instead.

## What we would do differently

- Agree *where the control lives* with a sketch before building UI for a requirement, not only what it does.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Avoid `scrollIntoView` in the editor — it walks every ancestor scroller (`lib/blocks/slash-menu.ts` already says so); scroll the container with `readBoxes`. Second time it came up: a candidate for `docs/conventions.md`.
