# No home page — open documents as tabs, and a collapsible sidebar

**Created**: 2026-10-08
**Issue**: #168
**Design**: no new module doc — the change lands in [`app-shell.md`](../../docs/design/app-shell.md) (the shell owns `/`, the sidebar and the frame around `<main>`).

Found while checking #142 by hand: on first entry no document is open, so the header roster has
nothing to scope to (the viewer plus every offline member, all dimmed), and moving between
documents replaces the one open document. Decided 2026-10-08, Obsidian-style:

- **A tab is only a navigation entry.** The active tab is the `/documents/[id]` route, the one
  document mounted and attached; inactive tabs are links. Presence, the roster, floating views,
  focus following (UC-030) and jump/return (#142) keep assuming one open document per route, so
  none of them changes — and "presence only for the focused tab, click to join" holds by construction.
- **Tabs are per browser** (`localStorage`, like the floating views and the chat window):
  `{ open: id[], active: id }`. Names are not stored — they come from the layout's catalogue,
  which the tree's socket already keeps current, so a rename shows and a deleted document's tab drops.
- **Any route change to a document opens it** (sidebar, new document, follow, jump, breadcrumb):
  appended if not open, activated if it is. Clicking in the sidebar adds a tab rather than
  replacing the current one.
- **The strip sits under the header, over `<main>` only** (the right-hand column, not the sidebar).
  Tabs behave like a browser's: they share the width and shrink as more open (up to 200px each,
  down to a minimum that still shows a few letters), and only past that does the strip scroll
  sideways. ✕ shows on the active tab and on hover.
- **Tabs reorder by drag** — native HTML drag and drop, no library; only the stored order changes.
- **Closing** the active tab moves to its right neighbour, else its left. The last tab has no ✕,
  so there is never an empty strip to bounce between `/` and a redirect.
- **`/` is a landing, not a home**: client-side `router.replace` to the stored active tab if it is
  still in the catalogue, else the sidebar's first row. With no documents at all the main area
  shows an empty state with a **새 문서** button — what a new member lands on. Client-side because
  the tab state lives in the browser, and the container smoke's `curl /` must keep getting the shell HTML.
- **The sidebar collapses to a rail** (added to this task 2026-10-08 at the user's request — it
  frees width for the tabs): a toggle; collapsed, a narrow column with the logo, expand, 새 문서
  and search (which expands and focuses the field). Per browser in a cookie, so the layout renders
  it collapsed from the first paint (`localStorage` is only read after it). The tree is
  hidden, not unmounted — its socket is what keeps the catalogue (and so the breadcrumb and the
  tab names) current.
- **One 새 문서 dialog, three callers** (the sidebar, the rail, the empty state): the dialog and its
  `create()` move out of `DocumentList` into a provider in the layout, the shape
  `FloatingViewProvider` already uses (a context exposing one `open` function).

From the issue comment: the logo-to-home link is skipped (there is no home to go to — `/` would
land straight back on the active tab), and 돌아가기 stays (FR-040-03 requires it; a jump inside
the same document changes no route, so the browser's Back cannot undo it or restore the block).

Out of scope: pinned/preview tabs, an empty tab, several editors mounted at once.

## Milestones

### 1. Tab state as arithmetic on a list

- **What**: `parseTabs(raw)` (anything malformed → empty), `openTab(state, id)`,
  `closeTab(state, id)` → the new state and the id to navigate to (or `null`),
  `moveTab(state, id, beforeId)`, `landingId(state, documents)` → the stored active if still
  present, else the sidebar's first row (`treeRows`), else `null`.
- **Files**: `lib/tabs.ts`, `lib/tabs.test.mts` (new).
- **Reuse**: the shape of `lib/floating/views.ts` — `STORAGE_KEY`, a forgiving parse, pure updates.
- **Done**: the cases under Test selection pass under Vitest.

### 2. The 새 문서 dialog as a layout-level provider

- **What**: the dialog, its state and `create()` move unchanged from `DocumentList` into a
  `NewDocumentProvider` with a `useNewDocument()` hook returning `open(parentId)`; the sidebar's
  two buttons call it.
- **Files**: `app/(workspace)/new-document.tsx` (new), `app/(workspace)/document-list.tsx`,
  `app/(workspace)/layout.tsx`, `app/(workspace)/document-list.test.tsx` (if it reaches the dialog).
- **Reuse**: the existing dialog markup and `create()`, moved, not rewritten;
  `FloatingViewProvider`'s context shape.
- **Done**: creating a document and a sub-document from the sidebar behaves as before
  (existing tests and `tree.e2e.ts` pass).

### 3. The tab strip and the `/` landing

- **What**: the strip between the header and `<main>` as described above; `/` lands on
  `landingId` or shows the empty state with a 새 문서 button.
- **Files**: `app/(workspace)/document-tabs.tsx` (new — strip and landing),
  `app/(workspace)/layout.tsx`, `app/(workspace)/page.tsx`.
- **Reuse**: `readViews`/`writeViews`' try/catch around `localStorage` and the read-after-mount
  in `floating-views.tsx`; `documentIdFromPathname` (`lib/focus/pathname.ts`); the layout's
  `documents` prop, as `Breadcrumb` uses it.
- **Done**: opening two documents shows two tabs; clicking one navigates; dragging reorders and
  survives a reload; ✕ on the active one lands on its neighbour; reloading `/` lands on the last
  active document; a rename shows in the tab; many tabs shrink before the strip scrolls.

### 4. The collapsible sidebar

- **What**: the toggle and the rail described above.
- **Files**: `app/(workspace)/sidebar.tsx` (new — the `<aside>` moved out of the server layout so
  it can hold client state), `app/(workspace)/layout.tsx`.
- **Reuse**: the layout's existing `cookies()` read; `useNewDocument()` for the rail's 새 문서.
- **Done**: collapsing leaves the rail, survives a reload, and a peer's new document still reaches
  the breadcrumb/tabs while collapsed.

### 5. Docs

- **What**: `app-shell.md` — Owns gains the new files; the "home page" paragraph becomes the
  tabs/landing/sidebar rationale above. `document-editing.md` if it describes the dialog inside
  `DocumentList`. `presence-and-focus.md`'s `"home"` return place gets a clause on when it can
  still happen (an empty workspace, or before the landing redirect).
- **Files**: `docs/design/app-shell.md`, `docs/design/document-editing.md`, `docs/design/presence-and-focus.md`.
- **Reuse**: —
- **Done**: `pnpm verify:docs` passes (ownership included).

### 6. One bar for the document (by-hand feedback on #178, 2026-10-09)

- **What**: the by-hand pass found the header, the tab strip and the 버전 히스토리 button in three
  places with three looks. Following Obsidian, Notion and wafflebase:
  - Tabs go outermost, on the sidebar's surface, with the active tab merging into the bar below
    and a `+` at the end.
  - Then one document bar holds the breadcrumb, presence, sharing and the history icon.
  - The content keeps only the title.
  - The host's Admin link moves to the sidebar foot as 관리자.
- **Files**: `app/(workspace)/layout.tsx`, `document-tabs.tsx`, `sidebar.tsx`, `ui.tsx`,
  `documents/[id]/editor.tsx`, `documents/[id]/version-history.tsx`, `docs/design/app-shell.md`,
  `e2e/tabs.e2e.ts`, `e2e/host.e2e.ts`.
- **Reuse**: `VersionHistory` unchanged except for its trigger, drawn into the bar with
  `createPortal`; the avatar's group-hover tooltip; `icon(PLUS)`, `useNewDocument()`, `AdminIcon`.
- **Done**: tabs sit above the bar and read as one piece with it; the history icon opens the panel
  from the bar; only the host sees 관리자, expanded or collapsed.

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior. For each relevant layer, name existing tests
that cover it, required updates/new cases, or a concrete reason no change is needed.

- Vitest (logic / component / server / route): new `lib/tabs.test.mts` — opening a duplicate,
  closing the active (right neighbour, then left), closing an inactive one, the last tab,
  moving before another tab and to the end, malformed storage, landing on a deleted active (falls
  back to the first tree row, orphans included), empty catalogue. `document-list.test.tsx` updated if the dialog move
  breaks its setup. `app/(workspace)/layout.test.tsx` tests only the server gate — no change.
- Browser E2E (`e2e/`): new `e2e/tabs.e2e.ts` for milestone 3's and 4's **Done** (drag via
  Playwright's `dragTo`). Existing specs that `goto("/")` now land on a document: `auth.e2e.ts`'s
  two `toHaveURL(/\/$/)` must accept `/documents/…`, and `tree.e2e.ts` read a new document's id
  from the URL right after `toHaveURL(/\/documents\//)` — already true after the landing — so it
  reads the id from the new sidebar row instead. Every `goto("/")` gets checked for the same assumption.
- Container smoke (`.github/workflows/ci.yml`): `curl /` still gets the shell HTML with the search
  field (the landing is client-side and the collapsed tree stays in the DOM) — no change;
  confirmed by running it.
- Commands and observed results (fill in before the PR):
  - `pnpm vitest run lib/tabs.test.mts "app/(workspace)"` → 12 files, 73 passed (19 new in `lib/tabs.test.mts`).
  - `tsc --noEmit` clean; `eslint` on every changed file clean; `pnpm verify:docs` clean after
    `node scripts/gen-endpoints.mjs` (moving `create()` moved `POST /api/documents`'s caller);
    `node scripts/comment-budget.mjs --strict` clean.
  - `pnpm e2e:isolated` (full suite) → 20 passed, the two `recovery.e2e.ts` diagnostics failing as
    marked (`test.fail`), 1 failed: `tabs.e2e.ts`'s own locator (`filter({ has })` rooted at the
    sidebar). Fixed, then `pnpm e2e:isolated e2e/tabs.e2e.ts e2e/tree.e2e.ts e2e/auth.e2e.ts` → 6 passed.
  - After the review round (below): Vitest 72 passed, `tsc`/`eslint`/`verify:docs` clean,
    `pnpm e2e:isolated e2e/tabs.e2e.ts e2e/tree.e2e.ts e2e/auth.e2e.ts e2e/host.e2e.ts` → 9 passed.
  - After milestone 6: `tsc`, `eslint` on its files, Vitest (72), `verify:docs` and the comment
    budget clean; `pnpm e2e:isolated` full suite → 21 passed (the two `recovery.e2e.ts`
    diagnostics failing as marked).
  - Container smoke: not run locally; its `curl /` checks read the sidebar's search field, which
    the server still renders (no cookie → expanded, and collapsed only hides it). CI runs it.

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] Entering the workspace with documents opens one directly; with none, the empty state and its 새 문서 button.
- [ ] Tabs persist across reloads in one browser, shrink before scrolling, reorder by drag; a deleted
      document's tab disappears, a renamed one updates.
- [ ] Only the active tab's document shows the viewer in the tree dots and the roster.
- [ ] Follow, jump and 돌아가기 still work, and add or activate tabs.
- [ ] The sidebar collapses to a rail and back, remembered per browser.
- [ ] `pnpm verify:docs`, Vitest and the E2E suite pass.

## Cross-cutting

- UC-040 / FR-040-01: the roster's scope (active document) is unchanged, but there is now always
  one unless the workspace is empty. FR-040-03 (돌아가기) stays as is.
- No SRS requirement names a home page or a sidebar state — nothing to change there.
- E2E specs that assumed `/` stays `/`.

## Review

Review round (2026-10-09; `/simplify` and `/code-review low` in a separate session):

- Applied: the 새 문서 provider's `open` is stable (`useCallback`) and takes the parent itself, so the
  dialog title reads the tree's socket-fresh name again (the code-review finding — the move had
  switched it to the layout's server list) and the provider no longer needs `documents`; the line
  icons moved to `ui.tsx`; the tab's ✕ reuses `icon()` with the floating window's path;
  `landingId` uses `treeRows`, so an orphan counts as a root as the sidebar draws it; `pruneTabs`
  and its current-route exception are gone — `closeTab` runs over the tabs shown and returns only
  the new state; `tree.e2e.ts` reads the new id from its sidebar row; small tidy-ups.
- Declined: a server `redirect()` from `/` with the active tab in a cookie. It removes a client
  round trip on `/`, but splits tab state across two stores and changes the CI smoke's `curl /`;
  the round trip happens only on entry, not on navigation. Revisit if the moment on `/` shows.
- Declined: `currentId` in place of `Tabs.active` for closing (both hold the same value whenever a
  tab can be closed), moving `SIDEBAR_COOKIE` to its own `lib/` file, and a shared `localStorage`
  helper for the three read/write pairs.

CodeRabbit (2026-10-09, on e0a3e0a): fixed its one finding — this doc still said `localStorage` for
the sidebar, which is a cookie. Not changed: a guard for a JSON `null` error body in `create()` (moved
verbatim from `DocumentList`, and the route always answers with an object) and the docstring-coverage
warning (comments here follow the comment budget, not a coverage target). The owning-docs reminder for
`document-editing.md` needs no edit: it owns `document-list.tsx` but never described the dialog.

Second `/simplify` + `/code-review low` (2026-10-09, on c707340): the review session briefly dropped
`openTab`'s `includes` check and put it back after its own code review caught it — `Tabs` does not
type "active is open", so the check stays. Applied: the rail's search finds the field by its label,
not as the sidebar's first input. Not changed: a shared tooltip (two copies, positioned differently),
a context in place of the `getElementById` slot (one read on mount of an element the layout always
renders), and the items already declined above.
