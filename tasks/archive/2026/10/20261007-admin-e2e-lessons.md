# Admin E2E — lessons

**Created**: 2026-10-07

## What surprised us

- User-location code reached main before admin. Verify actual ancestry instead of assuming both features share one merge.

- A kicked guest does not vanish from the header roster: the member record stays (UC-011 is not a ban), so they reappear dimmed as `· 오프라인` (FR-040-04). The spec asserts that, and the admin list losing the row.
- The first isolated run failed before any test because Playwright's headless shell was not installed on this machine; `pnpm exec playwright install chromium` fixed it.

## What we would do differently

- Inspect the merged configuration/auth behavior before designing unseeded setup and restart assertions.

## Worth extracting

- A spec that changes the workspace password must restore it: every later spec joins with the stack's password, and workers are 1, so a leak fails the rest of the run. A `finally` is not enough: after a test timeout the body keeps running while fixtures close, so this branch restores in a `test.afterEach` (the `page` fixture is still open there); that narrows the window rather than closing it. A host fixture whose teardown restores the password (and turns traces off) would close it — not done here because it reshapes `host.e2e.ts` too.
