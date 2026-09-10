# Component tests for issue #39's three regression bugs

**Created**: 2026-09-10
**Issue**: #39 (closes with #66 as a whole, not with this PR alone) · #66 (client-component track)
**Design**: no separate design doc — `docs/testing.md`'s "app/ client components" section
(once #88 merges) already scopes this; this task is that scope, executed.

## Milestones

### 1. `app/join/join-form.test.tsx` — two regression tests

- **What**: bug 1 (focus lands on the failed field after a forced-join error closes the takeover
  dialog, fixed in `981a87d`) and bug 3 (dismiss button + Esc blocked while a forced join is in
  flight, fixed in `788fab7`).
- **Files**: `app/join/join-form.test.tsx` (new).
- **Reuse**: `vitest.config.mts`'s `// @vitest-environment happy-dom` pragma, already installed
  `@testing-library/react`/`user-event`. No `lib/focus/` usage in `join-form.tsx` — its focus
  handling is plain `useRef`/`useEffect`, nothing to reuse there.
- **Done**: both tests pass against current source; verified against the actual pre-fix shape by
  temporarily reverting each fix locally and confirming failure, then reverting the revert.

### 2. `app/(workspace)/document-list.test.tsx` — one regression test

- **What**: bug 2 (Seoul-timezone date formatting, fixed in the same `981a87d`).
- **Files**: `app/(workspace)/document-list.test.tsx` (new).
- **Reuse**: same pragma/deps. `global.WebSocket` stubbed (happy-dom's real one would attempt a
  live connection) since the component's own effect opens one on mount.
- **Done**: renders a document with `updatedAt: "2026-01-01T15:30:00Z"` and asserts the Seoul-local
  day (Jan 2), not the UTC day (Jan 1). Verified against the actual pre-fix shape the same way.

## Acceptance

- [x] `pnpm test` — all 33 files / 459 tests pass (456 existing + 3 new), unmodified.
- [x] Both fixes' tests confirmed to actually fail against the pre-fix code (temporarily reverted
      locally, confirmed failure, reverted back — not just reasoned about).
- [x] `pnpm lint` / `pnpm build` clean.
- [x] `pnpm verify:docs` clean.

## Cross-cutting

`docs/testing.md`'s "app/ client components" row said "Not started" when this branch was first
cut from `main` (`docs/testing-strategy`/#88 hadn't merged yet). #88 merged mid-task; merged
`main` into this branch and updated that row to "3 regression tests landed (#39)" in the same PR
— done, not a follow-up.

No SRS requirement — this is harness/test-infrastructure work under #66/#67.

## Review

<!-- filled in at the end -->
