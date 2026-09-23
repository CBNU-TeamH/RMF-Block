# Performance criteria doc — apply review findings and move under docs/ — lessons

**Created**: 2026-09-23

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The fallback that looked universal (server clock + ack) only works for chat. Block edits and
  presenter position go client → Yorkie directly (`app/(workspace)/presence-provider.tsx`). The App
  server never sees them, and Yorkie is a Go binary we don't instrument. Where the data travels
  decides where a single clock can sit.
- Measuring tools we cannot instrument (Notion, Google Docs) is a solved problem: Writer and Reader
  on the same PC share one clock (Dang & Ignat, IFIP Networking 2016). It also removes the NTP step
  entirely — as long as the server is on another host, the network is still in the path.
- A heap snapshot is the wrong peak-memory reading twice over: it counts only the JS heap, and it
  forces a GC first.

## What we would do differently

- Check each cited source against the exact claim it sits next to before committing. Three of the
  four papers in the original section were real, but attached to the wrong claim (a loss rate, a SUS
  row, "collision").

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Candidate for `docs/testing.md`, once a performance layer exists: "a cross-client timing
  measurement names its transport path first (App WS vs Yorkie direct) — that decides whether a
  single-clock fallback exists." Not promoted yet: there's no harness to attach it to.
