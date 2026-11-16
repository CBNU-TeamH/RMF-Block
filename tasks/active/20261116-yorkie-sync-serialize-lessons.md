# Serialize the Yorkie sync loop — lessons

**Created**: 2026-11-16

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- A trace of the failing CI run held the cause: two `PushPullChanges` of one client started in the same millisecond, and the next push was refused. Reading the trace's network log (`*-trace.network`, with the request bodies under `resources/`) beat guessing from the screenshot.
- The sync loop does not retry after an `invalid_argument`: one such answer silences the client until reload.

## What we would do differently

- ...

## Worth extracting

- ...
