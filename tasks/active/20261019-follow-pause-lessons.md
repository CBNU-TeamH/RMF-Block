# Pause a follower who scrolls, edits or moves on, and resume (UC-030) — lessons

**Created**: 2026-10-19

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- A browser automation tool's "scroll" may move the page by script and fire no `wheel` at all. Code that reacts to a user's wheel looks broken under it. Check what the tool dispatches before blaming the code. Playwright's `mouse.wheel` sends a real one.
- `sentToRef === null` and a page that is not a document (`here === null`) compare equal. Without the explicit null check, a follower who joined in place and then left for `/files` was pulled straight back.

## What we would do differently

- Write the follow's route rules as a table of cases first: joined in place, joined from elsewhere, the presenter moves, the follower moves, the roster moves before the route. Each one turned into a test.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing yet.
