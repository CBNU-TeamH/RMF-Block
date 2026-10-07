# Admin and user-location E2E after admin integration

**Created**: 2026-10-07
**Design**: [API authentication model](../../docs/design/api.md), [testing strategy](../../docs/testing.md).

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

## Acceptance

- [ ] Admin is merged before implementation starts.
- [ ] All scenarios run against the actual merge and report observed results.
- [ ] Lint, unit tests, build, docs and three independent E2E runs are recorded.

## Cross-cutting

FR-010-01~05, FR-011-01~07, FR-040-01~04, NFR-REL-002. No product API/type/storage changes in this test task.

## Review

Deferred dependency: admin is unmerged at first-phase baseline `550dc2b`. User location is already merged; integrated revalidation still belongs to this separate task. Performance/LAN/multibrowser checks remain separate.
