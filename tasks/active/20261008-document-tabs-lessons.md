# No home page — open documents as tabs — lessons

**Created**: 2026-10-08

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- Opening a tab whenever "the route is not a tab" would make the active tab impossible to close:
  the route still names it until the navigation to the neighbour lands, so it would reopen at once
  (caught while designing, not by a test). Opening on a *change* of route — remembering the last
  route seen — is what works.
- A server component cannot read a plain constant out of a `"use client"` module — it gets a
  client reference, not the string. `SIDEBAR_COOKIE` had to move to `ui.tsx`, which has no directive.
- Moving a `fetch` between files makes `verify:docs` fail: `api.md`'s generated endpoint table
  lists callers, so `node scripts/gen-endpoints.mjs` has to rerun.
- `/` landing on a document broke an assumption in `tree.e2e.ts` silently, not loudly:
  `toHaveURL(/\/documents\//)` after creating a document was already true, so the test would have
  read the landed document's id. Every `goto("/")` had to be read for it.

## What we would do differently

- Playwright's `filter({ has })` takes a locator relative to the filtered element; passing one built
  from the page root matches nothing. Build the inner locator from scratch.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Constants a server component and a client component share go in a module with no directive.
