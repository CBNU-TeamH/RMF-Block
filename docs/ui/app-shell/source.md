# App Shell — presenter / follower wireframes

**Design**: Claude Design "Capde Draft" project archive, exported to the desktop
**Imported**: 2026-08-26 · marked **v0.1** (`app-shell.html`) / **v0.3** (`app-shell.jsx`)

## What is here

| File | What it is |
| --- | --- |
| `app-shell.jsx` | **The blueprint.** "Reusable wireframe parts of the App Shell — functional components, all stateless." Holds the Presenter view, Follower view (V3) and multi-presenter focus tab — UC-030 screens that the newer `../dashboard/dashboard.dc.html` does not cover. |
| `app-shell.html` | Loader for the above: React + ReactDOM + Babel standalone from unpkg, then the two `.jsx` files as `text/babel`. Open it in a browser to see the screens. |
| `design-canvas.jsx` | The canvas chrome the loader mounts into — "Figma-ish design canvas wrapper", artboards and post-it notes. Infrastructure, not design; kept only because `app-shell.html` will not render without it. |

**Needs internet.** The three unpkg scripts are CDN-loaded with SRI hashes; offline, the page is blank.

## Version, and what supersedes what

These are earlier than `../dashboard/`'s v0.4 artboard. For the **Home dashboard**, v0.4 is the
confirmed design — prefer it. What is only here is the presenter/follower work (Phase 3, UC-030),
which no newer file replaces.

The LocalGuard-era product name and its `LG` logo mark were stripped on import — see
[`../dashboard/source.md`](../dashboard/source.md#names-and-the-logo).

## Not imported

`App Shell Wireframes (Standalone).html` (1.4 MB) and `export/` (another 1.4 MB copy) are the
gzipped bundles [the README](../README.md) rejects; `(bundle-src).html`, `.thumbnail`,
`.design-canvas.state.json` and the nested `uploads/Capde Draft (1)/` duplicate are editor state and
dupes. The four PNGs under `uploads/` are pasted reference images — nothing in the source references
them, and they are not renders of these screens.
