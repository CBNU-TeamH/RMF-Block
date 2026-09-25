# Redesign — "B · Soft / paper"

**Design**: <https://claude.ai/design/p/ebd22520-b85e-44ea-8fba-29bac322865a>
(`ComponentSheet.dc.html`, `NotionRedesign.dc.html`, `StyleSheet.dc.html`, `rmf-theme.css`)
**Imported**: 2026-09-25 · `HANDOFF.md` only

## What is here

`HANDOFF.md` is the spec: the tokens (§2) and the per-component changes (§3). It is copied verbatim
from the design project and stays in Korean, the language it was written in. The `.dc.html` files
are not copied: they are prototypes that need their runtime to render, and HANDOFF says not to copy
their markup. Open them in Claude Design instead.

## What it replaces

This supersedes [`../dashboard/`](../dashboard/source.md) as the app's visual reference. The palette
stays: every `ink` / `paper` / `shell` / `sky` value in the old artboard keeps its value.
What changes is layout and surface:
- the document list moves into a sidebar tree;
- 1px ink borders give way to surfaces and shadows;
- the monospace labels go.

Decisions made while implementing it (2026-09-25):
- **Light only.** HANDOFF also specifies a dark column. It is deferred, but colours are named as
  tokens so dark can be added in CSS.
- **Styling only.** HANDOFF §3 also describes new behaviour. The in-screen items (chat grouping,
  a "나" badge, link copy, a presenting banner, upload progress) and the ones needing server or
  protocol changes (choosing a colour at join, an online count before join, a follower count,
  block duplicate/move) are tracked as separate issues rather than slipped into a restyle.
- **Chat and floating views stay floating windows.** The prototype's fixed right-hand panel was
  not adopted.
- **Pretendard ships with the app** (`app/fonts/`), not from the CDN HANDOFF names. The app has to
  render the same on a LAN with no internet.
- **The "r" logo box.** [`../dashboard/source.md`](../dashboard/source.md) removed a logo mark
  because inventing one would have been accidental. This one is the design's own choice, made
  deliberately in the redesign.
