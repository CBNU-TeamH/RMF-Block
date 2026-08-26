# UI & Design Assets — Storage Guide

This folder holds wireframes and screen designs. Module-design docs are a separate concern and live in `docs/design/`. Because this repo is the source of truth (loaded as shared context for the whole team and every AI agent), **store readable source, never bundled exports.** Keep it lean.

## What to store

| | Type | Why |
| :--: | :--- | :--- |
| ✅ | **Component source** — `.jsx` / `.tsx` | The implementation blueprint. Readable, greppable, converts straight into our Next/React/TS code. |
| ✅ | **Small static HTML** (e.g. < 20 KB) | Renders a preview and carries the CSS / design tokens. Readable. |
| ✅ | **PNG screenshot** (1 per screen) | Cheap visual index — glance at a screen without reading the source. |
| ⚠️ | `source.md` **pointer** (optional) | The Claude design project URL, so the design can be re-opened / edited later. |
| ❌ | **Standalone HTML** (~1.4 MB) | A gzipped JS bundle — opaque, unreadable, and large enough to blow an agent's context. |
| ❌ | **Whole Project archive** / `export/` / duplicate copies | Megabytes of bundles + triplicated files. Permanent repo bloat. |
| ❌ | **Editor state** (`.design-canvas.state.json`, `.thumbnail`) | Not source. Noise. |

### The one exception: a runtime that makes a screen viewable

A `.dc.html` artboard renders nothing on its own — it needs its `support.js`, and a React-loader
`.html` needs its `design-canvas.jsx`. Committing source but not those leaves a teammate able to
*read* a design and not to *see* it, which defeats the point of putting it here.

So a runtime file is worth committing when all three hold: it is the **only** thing standing between
the committed source and a rendered screen, there is **one copy** shared by every screen in the
folder, and it is **small** — tens of KB, not the megabyte-scale standalone export. `support.js`
(70 KB, pulls React/Babel from a CDN) qualifies. `*(Standalone).html` (1.4 MB, the whole app inlined
per screen) never does. Say which files are runtime, and that they are not design source, in that
screen's `source.md`.

## Why source, not bundles

A bundled export hurts in **two** places:

1. **Context tokens** — every time an agent reads it.
2. **Repo weight — forever** — every teammate clones it, and git history keeps it even after you delete it. Re-exporting on each iteration piles up dead weight that doesn't diff.

Reading "smartly" only fixes (1). The only way to fix (2) is to **never commit the bundle.** Commit readable source instead.

## Folder layout

One folder per screen:

```
docs/ui/
├── README.md              ← this guide
├── app-shell/
│   ├── app-shell.jsx      ← component source (the blueprint)
│   ├── app-shell.html     ← small static preview        (optional)
│   ├── app-shell.png      ← screenshot / visual index   (optional)
│   └── source.md          ← Claude design URL, for re-editing (optional)
└── <next-screen>/ ...
```

## How to add a design (from Claude design)

1. In Claude design, export as **Project archive** (the free, instant zip) — **not** "Standalone HTML".
2. Unzip it **outside** the repo (or into a temp/gitignored dir).
3. Copy only the readable source into `docs/ui/<screen>/` with the snippet below.
4. Commit the source. **Do not commit** the archive, the `Standalone` / `bundle-src` HTML, `export/`, or duplicate folders.

```bash
# Import a Claude design "Project archive" → readable source only
SRC="path/to/unzipped-archive"     # the export dir
DEST="docs/ui/app-shell"       # one folder per screen
mkdir -p "$DEST"
cp "$SRC"/*.jsx "$SRC"/*.html "$DEST"/ 2>/dev/null          # root-level source (skips nested dupes)
rm -f "$DEST"/*Standalone*.html "$DEST"/*bundle-src*.html   # drop the ~1.4 MB bundles
cp "$SRC"/uploads/*.png "$DEST"/ 2>/dev/null                # screenshots, if any
```

## For AI agents

When doing design / UI work, read the source in the relevant `docs/ui/<screen>/` — the `.jsx` / `.tsx` (and the `.png` for a quick look). **Do not open bundled HTML.** If a screen's intent isn't clear from the source, ask or inspect further — don't guess.
