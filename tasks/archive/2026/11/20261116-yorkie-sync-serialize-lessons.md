# Serialize the Yorkie sync loop — lessons

**Created**: 2026-11-16

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- A trace of the failing CI run held the cause: two `PushPullChanges` of one client started in the same millisecond, and the next push was refused. Reading the trace's network log (`*-trace.network`, with the request bodies under `resources/`) beat guessing from the screenshot.
- The sync loop does not retry after an `invalid_argument`: one such answer silences the client until reload.

- The guard we wrote first (does a fresh reader see the last edit?) passed on the unpatched SDK in half the runs, because Yorkie refusing the second push is a race. Counting the `PushPullChanges` in flight failed on the unpatched SDK in every run.
- CodeRabbit found three real problems after `/simplify` and `/code-review` had run, one of them a behaviour change the task doc had recorded as "accepted": a failing document skipped the rest of the tick, so it could starve a healthy one.
- A sub-agent's review of the plan was right where it contradicted the other's (`docker compose stop` removes the service name from DNS, so it fails at once; only `pause` leaves a connection unanswered), which only checking the claim against the code settled.

## What we would do differently

- Run the unpatched control before trusting any guard, and for a race assert what the code sends, not what the race then does.
- Check the declared return type of a function we patch, not only its callers: `Client.sync()` lost its result array and only the review noticed.
- Treat "accepted" in a task doc as a claim to verify, not a decision.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- A check for a race asserts what is sent or done, not the race's outcome: a candidate bullet for `docs/testing.md` "Writing a spec". Not promoted here, so this PR stays task files only.
- Changing a vendored patch touches three things: the patch, the lockfile's patch hash (`pnpm install --lockfile-only`, whose unrelated `deprecated:` lines are reverted by hand), and the ADR that describes the patch.
