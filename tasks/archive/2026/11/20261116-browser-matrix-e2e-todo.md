# Firefox and WebKit E2E runs

**Created**: 2026-11-16
**Design**: [testing strategy](../../../../docs/testing.md).

NFR-USA-005 asks for Chrome, Edge, Firefox and Safari. The E2E layer runs Chromium only, so three of the four are unverified.
This task makes the suite runnable on Firefox and WebKit and records what it finds; it does not put them in CI.

## Milestones

### 1. Opt-in projects

- **What**: `E2E_BROWSERS=all` adds `firefox` and `webkit` projects (`--project=firefox`, `--project=webkit`); an ordinary `pnpm e2e` and CI stay Chromium-only.
- **Files**: `playwright.config.ts`.
- **Reuse**: Playwright's `devices["Desktop Firefox"]` / `devices["Desktop Safari"]`, and `pnpm e2e:isolated`, which already passes `E2E_BROWSERS` through to Playwright.
- **Done**: `E2E_BROWSERS=all pnpm e2e:isolated --project=firefox --project=webkit` lists both projects.

### 2. Say why a test is skipped

- **What**: the specs that need a CDP session (`yorkieCut`, `networkProbe`, the IME specs) skip themselves on every browser but Chromium, with the reason in the report.
- **Files**: `e2e/network.ts` (`chromiumOnly()`), `e2e/collaboration.e2e.ts`, `e2e/ime-replay.e2e.ts`, `e2e/recovery.e2e.ts`, `e2e/table.e2e.ts`.
- **Reuse**: nothing new beyond Playwright's `test.skip(condition, description)` and `test.info().project`.
- **Done**: Firefox and WebKit report those 8 tests as skipped, not failed; Chromium runs them unchanged.

### 3. Record the results

- **What**: one full run per engine, failures kept and classified (test limit, flaky, product).
- **Files**: this task's Review, plus an issue for anything that is a product problem.

## Limits stated up front

- Edge shares Chromium's engine and is not run. WebKit is Playwright's build of Safari's engine, not Safari.
- The CDP specs (the outage/recovery and IME cases) are not exercised outside Chromium.

## Test selection

Use [the test-selection workflow](../../../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior.

- Vitest (logic / component / server / route): unchanged. No product code changes.
- Browser E2E (`e2e/`): the existing suite on two more engines; no new scenarios.
- Container smoke (`.github/workflows/ci.yml`): unchanged; Firefox and WebKit are not installed in CI.
- Commands and observed results (main `475fa10`, WSL2): plain `pnpm e2e:isolated` 35/35 on Chromium. `E2E_BROWSERS=all pnpm e2e:isolated --project=firefox --project=webkit`: Firefox 27 passed, 8 skipped (CDP), 0 failed; WebKit 20 passed, 8 skipped, 7 failed. The seven WebKit failures repeat: on a fresh stack, 3 runs each, 4 of 21 runs passed ([#253](https://github.com/CBNU-TeamH/RMF-Block/issues/253)). `eslint`, `tsc --noEmit`, `verify:docs` and the comment budget clean.

## Acceptance

- [x] A plain `pnpm e2e:isolated` still runs Chromium only and passes.
- [x] Firefox and WebKit full runs are recorded below, with each failure classified.
- [x] `eslint`, `tsc --noEmit`, `verify:docs` and the comment budget pass.

## Cross-cutting

SRS: NFR-USA-005. `docs/testing.md` gains the opt-in browsers bullet. No product change.

## Review

Opt-in Firefox and WebKit projects and explicit CDP skips shipped. Firefox: everything that can run, passes. WebKit: seven specs fail repeatedly (presence departures, tab dots, the share notice, a join form); whether that is the product or Playwright's WebKit on WSL2 is not known, and a Mac with real Safari would settle it. NFR-USA-005 is therefore Chromium and Firefox verified, WebKit not verified, Edge and Safari not run.
