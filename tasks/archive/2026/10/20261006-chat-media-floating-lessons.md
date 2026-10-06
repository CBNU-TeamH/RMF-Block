# Chat attachments in floating views, and the chat file list — lessons

**Created**: 2026-10-06

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- An unprefixed source key let a block in a document whose id is `file` collide with a file view (`file:f-1`). The test written for the "can't happen" case caught it; both kinds are now prefixed.
- `aria-label` on a plain `div` is ignored — a labelled set of toggles needs `role="group"`.
- Local E2E failed before any test ran: this WSL lacked Chromium's system libraries (`libasound.so.2`). `sudo playwright install-deps chromium` fixed it; CI's E2E step had already passed meanwhile.

## What we would do differently

- Rebuild the container before relying on it — it was running a 7-hour-old build, which would have tested old code.
- Read the E2E step's log, not the job's colour: the step is `continue-on-error`, so a green `container smoke test` does not say E2E passed.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Review passes as parallel sub-agents must be report-only — two agents editing one working tree collide. A line for `.claude/skills/README.md` if the team keeps this flow.
