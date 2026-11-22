# System tests for the requirements the D07 test report left unexercised — lessons

**Created**: 2026-11-18

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- #273 hid from every unit test. In the built container, `lib/auth` is loaded twice in one process, once by `server/index.mts` and once by the Next route bundle, so the route's `instanceof` checks never matched the server's error classes. Only a request against the running container showed it.
- #276: the browser that restores remounted its rows and the peer did not. The stored document was right, so the bug only appeared when the test checked a second screen.
- Running two Playwright workers on one stack broke it: the fixture nicknames are per run, so the workers kicked each other's sessions and got 401s. One worker, as the config has, is not just about speed.
- Cutting Yorkie (`yorkieCut`) also drops the member from everyone's roster, and a member who comes back already presenting does not count as a share that started. Holding only `PushPullChanges` with `page.route` keeps the member in the room while it misses the others' changes.
- Edge requests the favicon with a query string, which failed a test that refused any query string anywhere.

## What we would do differently

- Find the sync point before writing a negative assertion. Every fixed wait in this task drew a review comment, and each had an observable signal: the sidebar dot, an occupancy mark sent through the same presence after the ink, or a route's call count.
- Assert exact boundaries. A range (`> 40`, `< 64`) also passed a cap of 63, and an exact count caught it.
- Check that a test asserts every FR in its title. The restore test named FR-090-11 without checking it until the D07 mapping caught it.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- For `docs/testing.md`, E2E waits: a "nothing shows" assertion waits first for something that does show, from the same channel and sent after the thing that must not show. Not promoted in this archive PR, because the archive changes only task files.
- An error class that crosses `server/` and `app/` is matched by `name`, not `instanceof`. `namedError` in `lib/auth/types.ts` does this already. Worth a line in `docs/conventions.md` if a second module needs it.
