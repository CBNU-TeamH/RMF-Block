# design-sync notes (rmf-block)

rmf-block is an app, not a component library. The export list is curated by hand in `entry.tsx`.

## Build
- Run `node .design-sync/build-css.mjs` (cfg.buildCmd) before every converter run. It compiles `app/globals.css` with the repo's Tailwind v4 PostCSS plugin into `.design-sync/.cache/app.css` (cfg.cssEntry). Tailwind scans the whole repo, including `previews/`, so a class added to a preview needs this re-run. It also safelists the token colours and a basic layout vocabulary, which `conventions.md` documents.
- `entry.tsx` imports `process-shim.ts` first. Next client modules read `process.env.*` at load, and the IIFE has no `process`, so every card threw `ReferenceError: process is not defined` without the shim.
- `AppShell` (in `entry.tsx`) provides `AppRouterContext` and `PathnameContext`. `next/link`, `useRouter` and `usePathname` throw without it. It is also cfg.provider.
- `PresenceContext` is exported from `app/(workspace)/presence-provider.tsx` for previews only; `componentSrcMap` sets it to null so it gets no card.
- `overrides/source-kit.mjs` is a one-line fork: it skips Next dynamic-route segments (`[id]`) when deriving groups. Otherwise the block views grouped as "id".
- `docsMap.VersionHistory: null`: auto-discovery matched `docs/design/version-history.md`, which is an internal design doc, not usage.
- `guidelinesGlob: []`: `docs/*.md` are the SRS and code/test conventions, not design guidance.

## Harness (WSL, no sudo)
- Use Playwright 1.61.0 in `.ds-sync/`; it pins chromium-1228, the build already in `~/.cache/ms-playwright`.
- Chromium needed `libasound.so.2`, and headless rendering needed a Korean font. Both were unpacked from `apt-get download` debs (libasound2t64, fonts-nanum) into `.ds-sync/syslib/`. `source .ds-sync/env.sh` sets `LD_LIBRARY_PATH` and `FONTCONFIG_FILE` before build, validate and capture. Emoji still render as tofu locally (no emoji font); that is harness-only.

## Previews
- Previews stand in for the app server at its boundary: `window.fetch` (DocLink names, join 401, `/api/chat` history), a `WebSocket` that just opens (ChatPanel/ChatWindow backfill after `open`), and a stub `client.listRevisions` (VersionHistory).
- Image and PDF blocks show their not-found state: their `<img>`/`<iframe>` hit `/api/files/...`, which fetch mocks can't answer.
- DocumentEditor only shows its opening state ("여는 중…"), because it needs a live Yorkie client.
- Open states (DocumentRowMenu, ChatWindow, VersionHistory) are reached by a mount-time `click()` in the preview.
- Not shown: hover-only delete buttons and delete-confirm states (need interaction), and FocusShare's "following" state (FocusFollowContext is private).

## Known render warns
- `[FONT_MISSING] "JetBrains Mono", "Apple SD Gothic Neo"`: accepted by the user (2026-09-25). The app deliberately doesn't load JetBrains Mono (LAN, no internet) and falls back to ui-monospace. Apple SD Gothic Neo is a macOS system font.
- ChatWindow's review sheet clips the 💬 bar's corner. The capture keeps a 24px gutter, while the product card is full-bleed.

## Re-sync risks
- The curated export list in `entry.tsx` and `componentSrcMap` go stale when components are added or renamed under `app/`. Check both on every re-sync.
- Sample data inlined in previews mirrors types in `lib/` (WorkspaceDocument, ChatMessage, RevisionSummary shape). A type change breaks the preview compile, which falls back to the floor card.
- Fetch and WebSocket mocks match exact routes (`/api/chat`, `/api/workspace/join`, `/api/documents/<id>`). A route rename silently drops a card to its error or empty state.
- The Playwright pin is tied to the cached chromium build. A new cache means repinning.
- The branch is stacked on `feat/floating-view` (PR #122). FloatingFrame and floating-views don't exist on main until #122 merges.
