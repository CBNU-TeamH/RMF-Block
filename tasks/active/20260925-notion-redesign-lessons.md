# Redesign the app: "B · Soft / paper" — lessons

**Created**: 2026-09-25

## What surprised us

- HANDOFF §3 mixes styling with new behaviour, such as a colour picker at join and an online count shown before auth. We split the behaviour out before building, so this restyle would not quietly change the join protocol.

## What we would do differently

- Rebuild the container with `docker compose up --build -d app`, not `pnpm docker:up`. The latter stays attached to the logs, so a background run never finishes and a 25-second build looks like one that hung.
- Wait for `load` or an element in Playwright, never `networkidle`. The workspace keeps a WebSocket and Yorkie connection open, so the page is never idle.

## Worth extracting

- Shared UI chrome lives in `app/(workspace)/ui.tsx`. A route group is only a URL concern, so `app/join/` can import it too. That is worth a line in `docs/conventions.md` before a third copy of a dialog appears.
