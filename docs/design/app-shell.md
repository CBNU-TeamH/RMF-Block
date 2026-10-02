# App shell — Module Design

- **Status**: Built, by the B · Soft redesign (#125).
- **Owns**: `app/layout.tsx`, `app/(workspace)/layout.tsx`, `app/(workspace)/page.tsx`,
  `app/(workspace)/breadcrumb.tsx`, `app/(workspace)/read-documents.ts`, `app/(workspace)/ui.tsx`.
- **Related**: [`docs/ui/redesign/HANDOFF.md`](../ui/redesign/HANDOFF.md) (tokens, per-component
  visuals — not restated here); [`docs/ui/redesign/source.md`](../ui/redesign/source.md);
  [`api.md`](api.md) (the auth model behind the shell's gate); [`document-editing.md`](document-editing.md)
  (the document tree inside the sidebar).

## Scope

The frame every screen sits in: the root layout, the workspace shell (sidebar and header), the
home page, and the pieces the shell shares. What each piece looks like is `HANDOFF.md`'s job;
this doc covers why the frame is built the way it is.

## The shell is a layout, inside a route group

`app/(workspace)/layout.tsx` holds the sidebar document tree and the header. It is a layout
because Next keeps a layout mounted across navigations, so the tree keeps its socket, scroll and
collapsed state while documents open.

`(workspace)` is a route group: it adds the frame without adding a path segment, so the home page
is still `/`. `app/join/` sits outside the group, which is what keeps the join screen free of the
shell.

The auth gate lives in the layout, not in a page, so every screen in the group inherits it — no
session and no host cookie means the join form (FR-020-03/04). The session model itself is
[`api.md`](api.md), "Authentication model".

## One catalogue read per request

The layout (for the sidebar) and the document page both need the document catalogue.
`read-documents.ts` wraps `readDocuments()` — a synchronous file read and sort — in React's
`cache`, so a request reads it once however many server components ask.

The header's breadcrumb (`breadcrumb.tsx`) walks that same server-rendered list from the open
document up through its ancestors. It stays current without its own subscription: the sidebar
tree's socket calls `router.refresh()` on every catalogue change. The walk is bounded by the
list's length, so a corrupt catalogue with a cycle cannot loop forever.

With no document open, the home page (`page.tsx`) only points at the sidebar, where the tree is.

## Shared dialog chrome

`ui.tsx` is the one place for modal chrome — dialog frame, title, field label, input — used by
every modal in the app, including `app/join/`'s, which sits outside the shell. A new dialog takes
these classes rather than restyling its own.

## The font is bundled

`app/layout.tsx` bundles Pretendard instead of fetching it: the app runs on a LAN with no route to
a font CDN (`docs/ui/redesign/source.md`). It is a variable font, so one file covers every weight.
At about 2 MB it is left for CSS to discover at normal priority, with `swap` covering the gap,
rather than preloaded on every page including `/join`.
