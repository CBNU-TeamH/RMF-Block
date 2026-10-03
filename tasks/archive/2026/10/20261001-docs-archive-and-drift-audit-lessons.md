# Archive finished tasks and add version history to the SRS — lessons

**Created**: 2026-10-01

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **Two docs drew version history on the wrong side of the wire.** The SRS §2.1 diagram and
  `architecture.md` §3(c) both had the App/WS Server calling the revision API; the code calls it from
  the browser's `Client`, and the server's only part is the auth webhook. Both were written before
  #117 and nothing re-read them once it shipped — the design doc (`version-history.md`) was right
  the whole time, so the drift was between docs, not between a doc and nobody.
- **A shipped decision stayed "open" in four places** (`AGENTS.md` §7, ADR-002, `architecture.md`
  §3(c) and §4, `ROADMAP.md` Phase 5) because each recorded the question, and closing it in one did
  not reach the others.

## What we would do differently

- Split the drift audit out of this task from the start. It was planned as milestone 3 and moved to its own issue (#129) and PR; the task doc records the split.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing new. The "one fact, one place" rule these two findings motivated is already in `docs/conventions.md` (#133).
