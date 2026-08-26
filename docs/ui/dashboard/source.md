# Dashboard — App Shell wireframes

**Design**: <https://claude.ai/design/p/4aad0afc-2be6-4746-8bb8-b4b9e26eec8b> ("Capde 대시보드 홈 화면")
**Imported**: 2026-08-26 · file `Capde Dashboard.dc.html`

## What is here

`dashboard.dc.html` — the artboard source, five screens in one file:

| # | Screen | Size |
| --- | --- | --- |
| 1 | Editor (App Shell) | — |
| 2 | **Home — WorkSpace overview** (확정) | 1280 × 820 |
| 3 | Members | — |
| 4 | Storage | — |
| 5 | Settings | — |

Screen 2 is the one marked 확정 and the one the dashboard task builds. Its layout:
top bar (workspace name · `{{ presenceCount }}명 접속 중` · presence avatars · 🔔), a 200px left
sidebar (**workspace navigation only** — overview / Members / Storage / Settings, plus STARRED), and
a main pane holding the document list: search, type filter, `+ 새 문서`, then a table with
Title · Owner · **Here now** · Modified · Created and a row overflow menu.

Two things it assumes that we do not have yet: per-document presence ("Here now"), which needs the
`documentId` half of `docs/design/api.md` §4.1, and document metadata (owner, created, modified),
which needs the document table from `POST /api/documents`.

## Rendering it

`support.js` is committed next to the artboard, so opening `dashboard.dc.html` in a browser renders
it. That file is the generated `dc-runtime` bundle — normally exactly what [the README](../README.md)
rejects — and it is kept for one reason: without it there is no way for a teammate to *look* at the
design, only to read markup. It pulls React, ReactDOM and Babel from unpkg with SRI hashes, so
rendering needs internet. One copy serves every `.dc.html` in this folder.

`dashboard-v0.1.html` is the earlier standalone dashboard iteration, kept because it renders with no
runtime at all — plain inline CSS, no scripts of consequence. Useful as a fallback view and as the
record of what changed. **v0.4 (`dashboard.dc.html`) is the confirmed design**; this one is history.

## What is deliberately not here

- `uploads/` and `.thumbnail` — editor state and pasted reference images, not source.

`dashboard.dc.html` is 63 KB, over the README's "< 20 KB" guidance for static HTML. It is kept
anyway because it is hand-written inline-styled markup — readable, greppable, and diffable, which is
the property that guidance is protecting. The thing the README rejects is a bundle, and this is not
one.

## Names and the logo

The wireframes were drawn under the old product name. On import:

- The `LG` logo mark (LocalGuard) is **removed**, along with the divider that separated it from the
  workspace name — four instances in the v0.4 artboard, two in `dashboard-v0.1.html`, plus the now
  unused `.logo-mark` rule. The top bar starts at the workspace name. There is no replacement mark;
  we do not have one, and inventing one in a wireframe would be a decision made by accident.
- Every hardcoded **해커톤 워크스페이스** is now **RMF Block**, the default in
  `lib/workspace-config.ts`. The real value is whatever the host puts in `WORKSPACE_NAME`; the
  artboard already binds it as `{{ workspaceName }}` and this is only the placeholder shown when
  nothing is set. If the product name settles as something else, one `sed` over `docs/ui/` and
  `DEFAULT_WORKSPACE_NAME` moves it.

## Template bindings

`{{ workspaceName }}`, `{{ presenceCount }}`, `{{ presenceAll }}`, `{{ docCount }}`, `{{ docRows }}`,
and `sc-for` / `sc-if` are the artboard runtime's, not ours. Sample values live in the
`data-props` attribute at the end of the file.
