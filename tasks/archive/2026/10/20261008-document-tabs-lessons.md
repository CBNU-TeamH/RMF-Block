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

- The by-hand pass found what no test could. Every check was green while the header, the tab strip
  and the history button sat in three places with three looks. Fixing it (milestone 6) took one more
  round on a PR that was otherwise done.
- A review session asked to report only still edited the shared working tree. It dropped a check
  in `lib/tabs.ts`, then restored it after its own code review caught the change. `git status`
  here confirmed nothing was left over.

## What we would do differently

- Sketch where a new control sits against the existing rows before building it. Tabs added
  under the header, beside a title-row button, made a third row nobody had placed on purpose.
- Playwright's `filter({ has })` takes a locator relative to the filtered element; passing one built
  from the page root matches nothing. Build the inner locator from scratch.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Constants a server component and a client component share go in a module with no directive.
  This came up twice: `SIDEBAR_COOKIE`, then `DOCUMENT_ACTIONS_ID`, both in `ui.tsx`.
- Top-of-page order: tabs, then one bar for the open document (path, presence, its actions),
  then the content with only its title. Workspace-wide links go in the sidebar. This is the shape
  `app-shell.md` now states, worth checking any new header control against.
