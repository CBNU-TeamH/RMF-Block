# Runtime architecture visualization — lessons

**Created**: 2026-09-18

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The most important distinction is a negative one: document and presence traffic bypass the
  App/WS Server and connect directly to Yorkie over Connect / gRPC-Web.
- Archify can validate source links against a pinned Git commit, so the diagram's `SRC` markers do
  not depend on uncommitted working-tree content.

## What we would do differently

- Start with more open label corridors between the client and server columns; Korean relationship
  labels need more horizontal room than the first placement allowed.
- Run Archify in an environment with Chrome or Chromium when browser evidence and screenshot-based
  perceptual review are required.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing yet. One diagram is not enough evidence for a repository-wide visualization convention.
