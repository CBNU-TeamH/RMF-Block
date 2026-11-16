# Time out the Yorkie admin requests — lessons

**Created**: 2026-11-16

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- `call()` also serves `readDocumentRoots`; the plan said it had one caller.
- `registerAuthWebhook` retries every non-401 error 30 times, so a timeout alone does not make the refusal quick: about five minutes in the worst case.
- `docker compose stop yorkie` fails at once (the service name stops resolving), so an E2E that stops Yorkie would pass without this fix. Only `pause` leaves the connection unanswered, and then the lifecycle suite's 120 s is too short.
- Real timers cannot be sped up for `AbortSignal.timeout`; the unit test makes it return an already expired signal.

## What we would do differently

- Settle the limit and the retry with the team before building. They were open choices in the task doc and were decided alone when the team asked for everything to be merged.
- Run the hung path once against a paused container, even if it takes five minutes.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing new beyond the sync-serialize lessons.
