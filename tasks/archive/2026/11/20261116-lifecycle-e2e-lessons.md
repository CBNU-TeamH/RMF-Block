# Lifecycle E2E — lessons

**Created**: 2026-11-16

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The "host's screen" in FR-010-03 and FR-010-06 is the startup banner on stdout, so those two are log assertions, not page assertions.
- Stopping Yorkie and restarting the app does not reach "Refusing to start": the webhook registration `fetch` has no timeout and the connection to a stopped container's address hangs. A wrong admin password fails at once and does. Filed as #258 (no timeout on the Yorkie admin request).

## What we would do differently

- Read what the code does when a dependency is *unreachable* before writing the failure test: "Yorkie is down" and "Yorkie rejects us" take different paths, and only the second one is the refusal the docs describe.

## Worth extracting

- A spec that restarts or kills containers must only ever run against a stack its runner started: `e2e/stack.ts` reads the project from the runner's environment and has no default.
