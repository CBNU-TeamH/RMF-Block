# Perf harness: end a stalled round, retry the port check, keep a timed-out join — lessons

**Created**: 2026-10-27

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- A Playwright test timeout abandons the test body: its `finally` never runs, but `afterEach` does (checked with a throwaway spec: two timed-out tests, two `afterEach` runs, no `finally`). Cleanup that must survive a timeout belongs in a hook, not in the body's `finally`.

## What we would do differently

- **Fix the cause where it happens.** The first cut retried the port check before each round. The review moved the wait to `stackDown`, where Docker Desktop's late release actually happens, so a port that is really taken now fails at once instead of after a minute.
- **Do not test a report rule by spawning the whole report.** Loading Plot and happy-dom took about 50 s on a `/mnt/c` checkout. The rule went into a pure function (`joinAttempt`) with a 3-case unit test that runs in milliseconds.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **For `docs/testing.md`:** in a Playwright spec, cleanup that must survive a test timeout goes in `afterEach` or fixture teardown, never only in the body's `finally`.
