# Perf harness: don't race the follower's release at share end — lessons

**Created**: 2026-11-18

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The cleanup click was almost never needed: the app already releases a follower when the share ends. The failure was in the harness's own `isVisible()` then `click()`, not in the product.
- On one machine the old cleanup stalled in 1 of 40 cycles and the new one used its 2 s limit in 2 of 40, so the release usually wins by a hair and the race is rare, which is why `judge4` lost only 2 of 20 rounds.
- The suite's `actionTimeout` is 60 s, so one click on a vanished element costs a full minute and a whole 13-minute round.

## What we would do differently

- Read the round's failure log before the voiding decision: "element was detached from the DOM, retrying" already named the cause for `judge4` 13 and 15, and the operator's call to void them rested on it.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Harness code never checks and then acts on UI that other clients can change (`isVisible()` then `click()`). Use a bounded action and assert the end state.
