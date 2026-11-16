# Time out the Yorkie admin requests at startup

**Created**: 2026-11-16
**Issue**: #258
**Design**: [`docs/design/api.md`](../../docs/design/api.md) §2 (the startup webhook registration and why a failure must be loud).

If Yorkie does not answer at all while the app starts, the app prints nothing and never listens: `call()` in
`lib/yorkie-admin.ts` is a bare `fetch`, so an unanswered connection never reaches the `catch` in `instrumentation.ts`
that prints "Could not register the Yorkie auth webhook" and exits. A rejected request already does.

## Milestones

### 1. A timeout on every admin request

- **What**: `call()` aborts after a bounded time, so the existing catch prints its reason and the production process exits.
- **Files**: `lib/yorkie-admin.ts`; its unit test next to it.
- **Reuse**: the error path that already exists for a non-2xx answer (`YorkieAdminError`), extended with a message that says the request timed out and which address.
- **Done**: a unit test against a server that accepts the connection and never answers gets the timeout error within the limit; no change for a normal answer.
- **Open choice** (the limit): 10 s, enough for a slow Yorkie boot behind Compose's `service_healthy` and short enough that the host sees the refusal. `registerAuthWebhook` is the only caller of `call()`, so nothing else changes.

### 2. The lifecycle spec covers the unreachable case

- **What**: add to `e2e/lifecycle/lifecycle.e2e.ts` a case that starts a second app container while Yorkie is stopped and expects the same refusal, restoring Yorkie afterwards.
- **Files**: `e2e/lifecycle/lifecycle.e2e.ts`, `docs/testing.md` (the lifecycle bullet), and the comment in the existing refusal test that points at this issue.
- **Reuse**: `composeOutcome` and the one-off container pattern the rejected-password case uses.
- **Done**: `pnpm e2e:isolated --lifecycle` three runs green on independent stacks.

## Not in this task

- Retrying the registration: Compose already waits for Yorkie to be healthy, and a retry would hide the failure the refusal exists to show.

## Test selection

Use [the test-selection workflow](../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior.

- Vitest (logic / component / server / route): a case for the timeout in the admin client's test file.
- Browser E2E (`e2e/`): the lifecycle project (not in CI): the new case; the ordinary suite is untouched.
- Container smoke (`.github/workflows/ci.yml`): no change.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] An unanswered admin request fails with a clear error within the limit, in a unit test.
- [ ] `pnpm e2e:isolated --lifecycle` passes three runs in a row with the new case.
- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm verify:docs` and the comment budget pass.

## Cross-cutting

SRS: FR-010-06 (a startup failure shows its reason). No API, type or storage change. Closes #258.

## Review

Filled in at the end.
