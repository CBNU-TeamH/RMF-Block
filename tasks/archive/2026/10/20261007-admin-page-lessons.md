# Admin page — lessons

**Created**: 2026-10-07

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- Persistence looked like a bug: the host emptied `.env`, restarted, and got no setup screen — the volume still held the settings an earlier run had seeded. Correct by design and silent, so startup now says which workspace it resumed.
- Making scrypt async opened a race the sync version did not have: two setup requests could both pass "not open yet" while hashing. The check has to sit after the last `await`, right before the write.
- A small generic `send(url, method)` wrapper hid three new callers from `scripts/gen-endpoints.mjs`, so the generated table said "no fetch caller" on day one.
- A damaged settings file wants the opposite rule from `members.json`: there, throwing protects other people's records; here, a broken hash protects nothing and the setup screen is the repair.

## What we would do differently

- Start the by-hand run from an empty volume — a leftover file made the first round test the wrong state.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **Check-then-write after the last `await`**: a guard that decides whether to write must run with no `await` between it and the write. Candidate for `docs/conventions.md`.
- **Call `fetch` with a literal URL and method at the call site** (wrap the pending/error handling, not the request), or the generated endpoint table loses the caller. Candidate for `docs/conventions.md`.
- The fork's `main` lags `upstream/main` after a squash merge, so a branch cut from it misses the last merge — branch from `upstream/main`. `CONTRIBUTING.md` does not say so yet; a candidate for its path-to-a-PR section.
