# App shell — Module Design

- **Status**: Built, by the B · Soft redesign (#125).
- **Owns**: `app/layout.tsx`, `app/(workspace)/layout.tsx`, `app/(workspace)/page.tsx`,
  `app/(workspace)/breadcrumb.tsx`, `app/(workspace)/read-documents.ts`, `app/(workspace)/ui.tsx`,
  `app/(workspace)/document-tabs.tsx`, `app/(workspace)/sidebar.tsx`, `app/(workspace)/new-document.tsx`,
  `lib/tabs.ts`.
- **Related**: [`docs/ui/redesign/HANDOFF.md`](../ui/redesign/HANDOFF.md) (tokens, per-component
  visuals — not restated here); [`docs/ui/redesign/source.md`](../ui/redesign/source.md);
  [`api.md`](api.md) (the auth model behind the shell's gate); [`document-editing.md`](document-editing.md)
  (the document tree inside the sidebar).

## Scope

The frame every screen sits in: the root layout, the workspace shell (sidebar, header and document
tabs), the `/` landing, and the pieces the shell shares. What each piece looks like is `HANDOFF.md`'s job;
this doc covers why the frame is built the way it is.

## The shell is a layout, inside a route group

`app/(workspace)/layout.tsx` holds the sidebar document tree and the header. It is a layout
because Next keeps a layout mounted across navigations, so the tree keeps its socket, scroll and
collapsed state while documents open.

`(workspace)` is a route group: it adds the frame without adding a path segment, so the landing
is still `/`. `app/join/` sits outside the group, which is what keeps the join screen free of the
shell.

The auth gate lives in the layout, not in a page, so every screen in the group inherits it — no
live session and no valid host-secret cookie means the join form (FR-020-03/04). The session model itself is
[`api.md`](api.md), "Authentication model". Before the workspace is open the gate sends the host
to `/admin`, the setup screen (UC-010) — outside the group like `/join`, since there is no
workspace yet to frame. The header shows the host, and only the host, an outlined **Admin** link with a shield (`AdminIcon` in `ui.tsx`) to the same page.

Below the gate the layout nests `PresenceProvider`, `FocusFollowProvider`,
`FloatingViewProvider` and `NewDocumentProvider` around the sidebar/header/`<main>` frame, with the fixed `ChatWindow`
outside the column layout. They live here, not in a page, so floating windows and chat never
remount across navigation. The host has no `WorkspaceMember`, so it is given `HOST_PRESENCE` in
place of one, and `SessionWatch` (which shows an eviction) mounts for members only. It also hands `PresenceStack` the recorded members (`sessionRegistry.members()` without `lastJoinedAt`), so the roster can show who is not connected; `PresenceStack` calls `router.refresh()` once for a connected member it has not seen recorded, which is how a later joiner reaches that list.

## One catalogue read per request

The layout (for the sidebar) and the document page both need the document catalogue.
`read-documents.ts` wraps `readDocuments()` — a synchronous file read and sort — in React's
`cache`, so a request reads it once however many server components ask.

The header's breadcrumb (`breadcrumb.tsx`) walks that same server-rendered list from the open
document up through its ancestors. It stays current without its own subscription: the sidebar
tree's socket calls `router.refresh()` on every catalogue change. The walk is bounded by the
list's length, so a corrupt catalogue with a cycle cannot loop forever.

## No home page: documents open as tabs

There is no home screen (#168). With nothing open, the header roster had nothing to scope to and
showed only the viewer and every offline member; and opening a document replaced the one open.

**A tab is only a way back to a document.** The active tab is the `/documents/[id]` route — the one
document mounted and attached — and the rest are links (`document-tabs.tsx`). Presence, the
roster, floating views, focus following and the jump/return place all assume one document per
route, and that still holds; it is also why only the focused tab shows you to others, and why
opening another means clicking it. Any navigation to a document opens its tab — the tree, a new
document, a follow, a jump — appended if new, activated if not. Opening happens on a *change* of
route, so closing the active tab is not undone by the route that still names it until the
navigation to its neighbour (right, else left) lands. The last tab has no close button: an empty
strip would only send `/` back to it.

**Per browser, ids only.** The list lives in `localStorage` (`lib/tabs.ts`), like the floating
views and the chat window. Names come from the layout's catalogue, which the tree's socket keeps
current, so a rename shows in the tab and a deleted document's tab drops. Tabs share the width and
shrink as more open, as a browser's do, and the strip scrolls only past their minimum. They
reorder by native drag and drop.

**`/` is a landing.** It replaces itself with the last document this browser showed, else the
first root document — client-side, because that memory is in `localStorage`, and because the
container smoke reads the shell's HTML from `/`. Only an empty workspace stays there, with a 새
문서 button: what a new member lands on.

**One 새 문서 dialog.** The tree, the collapsed rail and the empty landing all open it, so it lives
in the layout as `NewDocumentProvider` (`new-document.tsx`), a context exposing one `open`, the
shape `FloatingViewProvider` already has.

## The sidebar collapses to a rail

`sidebar.tsx` collapses the sidebar to a column of icons — expand, search (which expands and
focuses the field), 새 문서. The tree is hidden, not unmounted: its socket is what keeps the
catalogue, and so the breadcrumb and the tab names, current. The state is a cookie rather than
`localStorage` so the layout renders it collapsed from the first paint instead of flashing the
full width; `SIDEBAR_COOKIE` sits in `ui.tsx` because a server component cannot read a constant
out of a client module.

## Shared dialog chrome

`ui.tsx` is the one place for modal chrome — dialog frame, title, field label, input — used by
the app's `<dialog>` modals, including `app/join/`'s, which sits outside the shell, and the
version-history confirm dialogs. (The history panel itself is a custom overlay, not a dialog.) A
new dialog takes these classes rather than restyling its own. `ui.tsx` also exports the non-modal
`Spinner`, `FileIcon` and `TrashIcon` (the host's trash on `/admin`), and the shell's line icons
(`icon`, `PLUS`, `SEARCH`) the sidebar tree and its collapsed rail share.

## The font is bundled

`app/layout.tsx` bundles Pretendard instead of fetching it: the app runs on a LAN with no route to
a font CDN (`docs/ui/redesign/source.md`). It is a variable font, so one file covers every weight.
At about 2 MB it is left for CSS to discover at normal priority, with `swap` covering the gap,
rather than preloaded on every page including `/join`.
