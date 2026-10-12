# Two-device performance harness (e2e/perf) — lessons

**Created**: 2026-10-13

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **A renderer started after a memory-infra trace begins is named by its command line**, not `"Renderer"`. Its `process_name` metadata is `…--type=renderer…`. G's page navigates after the trace starts, so G's memory samples came back empty until `memory.ts` matched both forms.
- **A new document ends in an empty block.** Typing 60 blocks yields 61 textareas, which the eight-user E2E already encodes as 9 for 8.
- **Nicknames are capped at 20 characters, and the join API answers the cap with a generic "입장하지 못했습니다".** The fixture's `e2e-<E2E_RUN_ID>-<slot>` overflowed when `E2E_RUN_ID` was the long perf run id, and only the server log said why.
- **The outage round shows #193's findings already on one machine.** Chat backfill waits about 10 s on the socket's reconnect backoff, and the session socket never reconnects (#37).

## What we would do differently

- Start the memory trace only after G has landed in the app, or match renderers by command line from the start. A spike that sets content on `about:blank` does not exercise the navigation that changes the renderer process.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- `verify:docs` resolves every backtick path with a slash, including a trailing-slash directory claim. A gitignored or not-yet-created path (`perf-results`, a results file a later PR adds) has to be written without that shape, or the check fails in CI.
