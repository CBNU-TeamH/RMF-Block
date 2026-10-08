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
  still in the catalogue, else the first root document. With no documents at all the main area
  shows an empty state with a **새 문서** button — what a new member lands on. Client-side because
  the tab state lives in the browser, and the container smoke's `curl /` must keep getting the shell HTML.
- **The sidebar collapses to a rail** (added to this task 2026-10-08 at the user's request — it
  frees width for the tabs): a toggle; collapsed, a narrow column with the logo, expand, 새 문서
  and search (which expands and focuses the field). Per browser in `localStorage`. The tree is
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
  present, else the first root document, else `null`.
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
- **Reuse**: the same `localStorage` pattern; `useNewDocument()` for the rail's 새 문서.
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

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior. For each relevant layer, name existing tests
that cover it, required updates/new cases, or a concrete reason no change is needed.

- Vitest (logic / component / server / route): new `lib/tabs.test.mts` — opening a duplicate,
  closing the active (right neighbour, then left), closing an inactive one, the last tab,
  moving before another tab and to the end, malformed storage, landing on a deleted active (falls
  back to the first root), empty catalogue. `document-list.test.tsx` updated if the dialog move
  breaks its setup. `app/(workspace)/layout.test.tsx` tests only the server gate — no change.
- Browser E2E (`e2e/`): new `e2e/tabs.e2e.ts` for milestone 3's and 4's **Done** (drag via
  Playwright's `dragTo`). Existing specs that `goto("/")` now land on a document: `auth.e2e.ts`'s
  two `toHaveURL(/\/$/)` must accept `/documents/…`, and `tree.e2e.ts` reads a new document's id
  from the URL right after `toHaveURL(/\/documents\//)` — already true after the landing, so it
  must wait for the URL to change. Every `goto("/")` gets checked for the same assumption.
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

Filled in at the end: what shipped, what was cut, what moved to another task.
