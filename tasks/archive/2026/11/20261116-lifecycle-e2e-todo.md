# Lifecycle E2E: workspace opening, restart, kill, startup refusal

**Created**: 2026-11-16
**Design**: [API authentication model](../../../../docs/design/api.md) (§2 startup, workspace state in `.data/`), [testing strategy](../../../../docs/testing.md).

Closes the open acceptance of [the admin E2E task](20261007-admin-e2e-todo.md): "setup/restart run in separate
disposable stacks without contaminating ordinary E2E sessions". The ordinary stack is seeded from `WORKSPACE_PASSWORD`
and shared by every spec, so these cases cannot run on it.

## Milestones

### 1. A stack nobody has set up

- **What**: `pnpm e2e:isolated --lifecycle` starts the disposable stack with no `WORKSPACE_PASSWORD`, runs only `e2e/lifecycle/`, and hands the specs the stack's Compose project and file.
- **Files**: `scripts/e2e-isolated.mjs`, `playwright.config.ts` (a `lifecycle` project that exists only under `E2E_LIFECYCLE`), `e2e/stack.ts` (`compose`, `appLog`, `appReady`, `composeOutcome`).
- **Reuse**: the runner's whole startup/teardown, port checks and redaction; Compose `run`/`kill`/`restart` through the same `docker compose -p … -f …` the runner uses.
- **Done**: an ordinary `pnpm e2e` and CI never see the lifecycle project; without the runner's variables `e2e/stack.ts` refuses to run.

### 2. The four behaviours, in order on that one stack

- **What**: (1) an unopened workspace answers 503 to a join and the host opens it from the setup screen, after which only that password admits (FR-010-01~04); (2) an app restart keeps the workspace, password and documents and ends every session (FR-010-05, NFR-REL-002); (3) after the app and Yorkie are killed with SIGKILL, the last persisted document returns from MongoDB (NFR-SAF-003); (4) an app that cannot register with Yorkie exits with its reason (FR-010-06).
- **Files**: `e2e/lifecycle/lifecycle.e2e.ts`.
- **Reuse**: `users`/`visitor`, `createDocument`, `openDocument`, `insertAt`, `block` from `e2e/helpers.ts`.
- **Done**: the four pass on one run of `pnpm e2e:isolated --lifecycle`, three runs in a row.

## Findings that shaped it

- **"The host's screen" is the container's stdout.** FR-010-03 (join address) and FR-010-06 (why startup failed) are printed by `instrumentation.ts` to the host's terminal; no page shows them. The specs assert on `docker compose logs app`.
- **A stopped Yorkie does not make the app refuse to start; it hangs.** `lib/yorkie-admin.ts` `call()` has no timeout on its `fetch`, so an unreachable (not rejecting) Yorkie leaves startup waiting without output; the "Refusing to start" path is reached only when Yorkie answers with a failure such as a wrong admin password. FR-010-06 is therefore tested with the wrong-password case. The hang is reported separately, not fixed here.

## Test selection

Use [the test-selection workflow](../../../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior.

- Vitest (logic / component / server / route): unchanged. No product code changes.
- Browser E2E (`e2e/`): new `e2e/lifecycle/`, run only by `pnpm e2e:isolated --lifecycle`; ordinary E2E unchanged.
- Container smoke (`.github/workflows/ci.yml`): unchanged. The lifecycle specs are not in CI: they need their own stack and several minutes.
- Commands and observed results (main `475fa10`, WSL2 + Docker Desktop): `pnpm e2e:isolated --lifecycle` 4/4 on three independent stacks (about 33 s each); `pnpm e2e:isolated` 35/35 with `e2e/lifecycle/` not collected (two `diagnostic:` expected failures, #37). `tsc --noEmit`, `eslint e2e scripts/e2e-isolated.mjs playwright.config.ts`, `verify:docs` and the comment budget clean. Vitest untouched.

## Acceptance

- [x] `pnpm e2e:isolated --lifecycle` passes three runs in a row on independent stacks.
- [x] `pnpm e2e:isolated` (ordinary) still passes the whole suite and does not collect `e2e/lifecycle/`.
- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] `pnpm lint`-equivalent eslint run, `tsc --noEmit`, `verify:docs` and the comment budget pass.

## Cross-cutting

SRS: FR-010-01~06, NFR-REL-002, NFR-SAF-003. `docs/testing.md` gains the lifecycle-stack bullet. No product API, type or storage change.

## Review

Shipped as milestones 1 and 2. FR-010-06 is tested with a wrong Yorkie admin password because a stopped Yorkie makes the app hang silently (see Findings); that hang is not fixed here and needs its own issue.
