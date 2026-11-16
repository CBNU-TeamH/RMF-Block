# Admin and user-location E2E after admin integration

**Created**: 2026-10-07
**Design**: [API authentication model](../../../../docs/design/api.md), [testing strategy](../../../../docs/testing.md).

## Milestones

### 1. Start after the admin merge

- **What**: create `test/admin-e2e` from the actual merged `main`; use a separate worktree and a separate todo/lessons pair from first-phase coverage.
- **Files**: admin E2E files and the isolated runner as required by the merged contracts.
- **Reuse**: first-phase user fixtures and isolated Compose execution.
- **Done**: admin development changes remain untouched, with no cherry-pick or copied unmerged code.

### 2. Admin behavior and user location

- **What**: verify unseeded host setup then guest join; reject guest/visitor admin page and API access; retain existing guest sessions across password changes while accepting only the new password for fresh joins; cancel/confirm kicks, affect only the target and permit rejoining; follow another user's document/block and return; persist name/password across app restart and invalidate prior sessions.
- **Files**: `e2e/` and `docs/testing.md`.
- **Reuse**: real UI and merged auth/location contracts; restore changed passwords in teardown.
- **Done**: setup/restart run in separate disposable stacks without contaminating ordinary E2E sessions.

### 3. What this branch covers (2026-11-16, `test/admin-e2e`)

- **What**: the sprint 14/15 behaviour on the ordinary seeded stack — guest/visitor refused by `/admin` and its two APIs; a password change that keeps a connected guest and admits only the new password (restored in a `test.afterEach`); kick cancel/confirm, the kicked guest's notice and 401, the remaining guest's roster, and rejoining; a jump from a tree dot to a colleague's block far down a long document (asserted in the viewport), 돌아가기, and the dot gone once they leave.
- **Files**: `e2e/admin.e2e.ts`, `e2e/location.e2e.ts`; `bootstrapHost` moved from `e2e/host.e2e.ts` to `e2e/helpers.ts` so both host specs share it; `docs/testing.md`.
- **Reuse**: `users` fixture, `joinForm`, `online`, `openDocument`, `insertAt`.
- **Done**: the three specs pass on `pnpm e2e:isolated`.
- **Not here**: unseeded setup and restart persistence need a stack started without `WORKSPACE_PASSWORD` and an app restart mid-test — still open below.

## Acceptance

- [x] Admin is merged before implementation starts (PR #170).
- [x] All scenarios run against the actual merge and report observed results.
- [x] Lint, unit tests, build, docs and three independent E2E runs are recorded.

## Cross-cutting

FR-010-01~05, FR-011-01~07, FR-040-01~04, NFR-REL-002. No product API/type/storage changes in this test task.

## Review

Milestone 2 (unseeded setup, restart, kill recovery) landed as the lifecycle task, PR #255 (`20261116-lifecycle-e2e`); the admin specs landed in #252.

Admin merged in PR #170. The first-phase suite was revalidated against `2608675`; admin-specific scenarios and integrated user-location navigation still belong to this separate task. Performance/LAN/multibrowser checks remain separate.

2026-11-16, milestone 3 on `f64c68f` (macOS arm64, `pnpm e2e:isolated`): `admin`, `location` and `host` specs passed 7/7 in three separate isolated stacks, and again after the `/simplify` cleanups. The full suite passed 33/35: `ime-replay` failed once and passed alone; `tabs.e2e.ts:4` failed twice here (the tab title missed a rename made after `page.reload()`), while both pass in main's CI run for `f64c68f`. Lint, typecheck, 908 unit tests, `verify:docs` and the comment budget passed. Unseeded setup and restart persistence moved to [the lifecycle E2E task](20261116-lifecycle-e2e-todo.md).
