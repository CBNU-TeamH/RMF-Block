# Republish the focused block when the editor's effect re-runs — lessons

**Created**: 2026-11-25

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The issue's proposed fix contradicted a rule in `floating-view.md`; reading who actually clears presence (only the editor's cleanup) showed the reported case was a re-run, not a second holder.

## What we would do differently

- A hook test that needs presence can't read it back from a local `yorkie.Document`; wrapping `update` to record each `presence.set` tests what the hook publishes without faking the SDK.


## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing yet.

