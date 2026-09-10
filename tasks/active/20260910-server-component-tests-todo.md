# Server-component Tier 1 tests (issue #66, C4 server components)

**Created**: 2026-09-10
**Issue**: #66 (Tier 2 — extracting gate/join logic into `lib/` — is a separate, later task)
**Design**: no separate design doc — `docs/testing.md`'s "app/ server components" section (Tier
1) scopes this; this task is that scope, executed.

## Milestones

### 1. Four Tier-1 tests, one per named risk

- **What**: `app/(workspace)/layout.tsx`'s auth gate (FR-020-04), `app/join/page.tsx`'s
  already-signed-in redirect, `app/(workspace)/documents/[id]/page.tsx`'s `notFound` for an
  unknown id, `app/(workspace)/page.tsx`'s null-creator join.
- **Files**: `app/(workspace)/layout.test.tsx`, `app/join/page.test.tsx`,
  `app/(workspace)/documents/[id]/page.test.tsx`, `app/(workspace)/page.test.tsx` (all new).
- **Reuse**: default `environment: "node"` — none of the four need a DOM. `redirect()`/
  `notFound()` really `throw` in `next@16.2.12` (confirmed against `node_modules/next/dist/...`),
  so the three gate/redirect/not-found cases are `assert.rejects`, not `render()`; the join case
  is a direct check on the returned element's `props`.
- **Done**: 6 tests total (2 for the auth gate — fires and doesn't; 2 for the join-page redirect —
  host cookie and existing session, each a separate branch of the `||`; 1 for `notFound`; 1 for
  the creator join, covering both the resolved and null cases in one fixture). Verified the auth
  gate test actually catches a regression by temporarily flipping its `&&` to `||` locally,
  confirming the "does not redirect" test fails, then reverting — clean and fast, no hang (unlike
  one case in the client-component tier's own verification).

### 2. Correct two things found while grounding this in real code, not the issue's paraphrase

- **What**: issue #66 says these four components are "179 lines" — actual current total is 220
  (the codebase grew since the issue was filed). Also, the issue's shorthand "FR-020-03/04 auth
  gate" is imprecise — FR-020-03 is the password check itself (upstream, in `/api/auth/*`);
  `layout.tsx` only enforces FR-020-04's absence-of-session side. Neither correction changes the
  tests; both changed how `docs/testing.md`'s prose describes them.
- **Files**: `docs/testing.md` (prose + status row).
- **Done**: no stale figures or loose citations repeated into a doc meant to stay accurate.

## Acceptance

- [x] `pnpm test` — all 37 files / 465 tests pass (459 existing + 6 new), unmodified.
- [x] The auth gate test confirmed to actually fail against a broken gate (temporarily flipped
      locally, confirmed failure, reverted).
- [x] `pnpm lint` / `pnpm build` clean.
- [x] `pnpm verify:docs` clean.
- [x] `docs/testing.md`'s server-component row updated; Tier 2 explicitly left open.

## Cross-cutting

Docs-only alongside the tests — no production code changed (the four components under test are
unmodified). Tier 2 (extract gate/join logic into `lib/`, using Tier 1 as the safety net) and the
route-handler tier are both still open under #66.

## Review

<!-- filled in at the end -->
