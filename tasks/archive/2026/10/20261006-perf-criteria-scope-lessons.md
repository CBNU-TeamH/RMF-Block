# Perf criteria — scope to "our performance under conditions" — lessons

**Created**: 2026-10-06

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- Local `main` was 17 commits behind `origin/main`; branching from it would have missed the doc's current location. Fetch first — and fetch again mid-task: the E2E layer (#153) landed between the first fetch and the layout decision.
- `verify:docs` treats a backticked path in `docs/` as a claim that it exists when it ends in `/` or a known extension. A not-yet-built directory has to be written without the trailing slash (`e2e/perf`, `perf-results`); a glob like `e2e/perf/*.perf.ts` is not matched.
- The doc's "4 layers" was already stale the moment #153 merged — a cross-doc count is drift waiting to happen.

## What we would do differently

- Open the PR against `CBNU-TeamH/RMF-Block` from the start — `origin` is the fork, and a bare `gh pr create` opened it there first (#1 on the fork, closed).
- Write the run order once, in the criteria doc, and point at it from the task doc. Two copies drifted after the review fix, and CodeRabbit had to find the stale one.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- `verify:docs`'s future-path rule (a not-yet-existing directory is written without its trailing slash) belongs in `docs/conventions.md` — left for a docs PR, since an archive PR carries task files only.
