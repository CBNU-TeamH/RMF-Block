# Functional E2E coverage — lessons

**Created**: 2026-10-07

## What surprised us

- Playwright 1.61 automatically starts tracing on `browser.newContext()` inside its browser fixture. Starting or stopping it again conflicts with its artifact recorder; only own context closure. Failure traces include all user contexts.
- Chromium offline leaves existing watch responses and sockets open. Abort active watch fetches and close actual browser sockets, then assert CDP termination and browser close events before editing offline.
- Preparing the undo case in an empty block records a separate trailing-block append. Seed the document first, then assert undo/redo of the specific text operation while preserving the peer edit.
- Generated copied reports need the same ESLint/Docker ignores as the normal Playwright report directories.
- The local `main` was behind remote `main`; user location already merged, while admin remained unmerged. Branch from the fetched remote baseline.
- Initial Yorkie setup failure is terminal (#37); SessionWatch and DocumentList do not reconnect. Recovery diagnostics must report these as failures, without skip or expected-failure annotations.

## What we would do differently

- Reuse eight nickname slots within a run. Closing a browser context does not delete its durable membership or its session record, so setup explicitly replaces old slot sessions.

## Worth extracting

- No new product convention. Disposable Compose execution and observable network outages belong in the E2E instructions.

## Review decisions

- `/simplify` ran in Claude CLI (report-only). Applied a shared selection helper, removed an unused probe accessor and used `performance.timeOrigin` to prove no tree reload. Kept all-settled context teardown to await every close before propagating errors.
- Kept startup-secret scraping and resolved Compose rewriting: the user explicitly requires the printed secret, unique names and the effective existing configuration. Pinning a secret or relying on merged override ports would change those requirements.
- Changed signal handling to terminate the owned subprocess group, including Playwright children, before project teardown.

## Integration and workflow follow-through

- Running the unchanged E2E suite after admin merged preserved the same 16/2 outcome; the two
  recovery defects are independent of the admin changes.
- Test-layer descriptions and CI result checkboxes did not require feature authors to inspect
  missing scenarios. Promoted a test-selection procedure into `docs/testing.md`, with pointers
  and decision fields in the agent workflow, contributor guide and task/PR templates.
- Keep shared-stack cleanup instructions when adding disposable execution: app catalogue cleanup
  and Yorkie/Mongo reset are different operations.
