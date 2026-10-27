# Perf harness: end a stalled round, retry the port check, keep a timed-out join — lessons

**Created**: 2026-10-27

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- A Playwright test timeout abandons the test body: its `finally` never runs, but `afterEach` does (checked with a throwaway spec: two timed-out tests, two `afterEach` runs, no `finally`). Cleanup that must survive a timeout belongs in a hook, not in the body's `finally`.

## What we would do differently

- ...

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- ...
