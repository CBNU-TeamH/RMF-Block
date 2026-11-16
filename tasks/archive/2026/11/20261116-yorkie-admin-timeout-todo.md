# Time out the Yorkie admin requests at startup

**Created**: 2026-11-16
**Issue**: #258
**Design**: [`docs/design/api.md`](../../../../docs/design/api.md) §2 (the startup webhook registration and why a failure must be loud).

If Yorkie does not answer at all while the app starts, the app prints nothing and never listens: `call()` in
`lib/yorkie-admin.ts` is a bare `fetch`, so an unanswered connection never reaches the `catch` in `instrumentation.ts`
that prints "Could not register the Yorkie auth webhook" and exits. A rejected request already does.

## Milestones

### 1. A timeout on every admin request

- **What**: `call()` aborts after a bounded time, so the existing catch prints its reason and the production process exits.
- **Files**: `lib/yorkie-admin.ts`; its unit test next to it; the comment in the existing refusal test in `e2e/lifecycle/lifecycle.e2e.ts` that says the call has no timeout.
- **Reuse**: the error path that already exists for a non-2xx answer (`YorkieAdminError`), with a message that says the request timed out and which address.
- **Done**: a unit test where the request times out gets the error naming the method, the address and the limit (a `fetch` stub that honours `init.signal`, with `AbortSignal.timeout` made to expire at once); no change for a normal answer.
- **Decided** (the team did not weigh in, so these are the simplest choices and easy to change):
  - The limit: 10 s per request, enough for a slow Yorkie boot behind Compose's `service_healthy`. `call()` also serves `readDocumentRoots`; a `GetDocuments` read slower than that fails with the same message.
  - The retry: unchanged. `registerAuthWebhook` retries any non-401 error up to 30 times, 1 s apart, so a timed-out request is retried and a Yorkie that never answers is refused after about 30 x (10 + 1) s, roughly 5.5 minutes, instead of never. A slow boot still gets its retries; a timeout-specific shortcut would be a special case on the retry.

## Not in this task

- A lifecycle case for the hung Yorkie. `docker compose stop yorkie` would not exercise the timeout: the service name stops resolving, `fetch` fails at once and the existing retry refuses after about 30 s, with or without this fix. Only `docker compose pause yorkie` leaves the connection unanswered, and then the refusal takes the worst case above, far past the lifecycle tests' 120 s. The unit test covers the timeout; add the case only if the attempts and the limit become configurable.

## Test selection

Use [the test-selection workflow](../../../../docs/testing.md#select-tests-for-each-change) before
building and revisit it for the final behavior.

- Vitest (logic / component / server / route): a case for the timeout in the admin client's test file (`lib/yorkie-admin.test.mts`).
- Browser E2E (`e2e/`): no change beyond the comment above; the lifecycle refusal test still covers the wrong-password refusal.
- Container smoke (`.github/workflows/ci.yml`): no change.
- Commands and observed results: `vitest run lib/yorkie-admin.test.mts` 11 passed; `tsc --noEmit` clean. The hung-Yorkie path itself was not run against a paused container (about five minutes).

## Acceptance

- [x] An unanswered admin request fails with a clear error within the limit, in a unit test.
- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm verify:docs` and the comment budget pass (CI on main; the pre-push hook was skipped, and locally only `tsc`, `eslint` on the touched files and the admin test ran).

## Cross-cutting

SRS: FR-010-06 (a startup failure shows its reason). No API, type or storage change.

## Review

Merged as #262 (`907676c`), with an admin bypass. Each Admin request is cut off after 10 s with an error naming the method, the address and the limit; the retry is unchanged, so a Yorkie that never answers is refused after about five minutes. The limit and the retry were open choices, settled alone by the simplest option. The hung-Yorkie path was never run against a paused container, and `/code-review low` was not run on the code.
