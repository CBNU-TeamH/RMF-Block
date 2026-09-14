# Route-handler tests (issue #66's last docs/testing.md layer)

**Created**: 2026-09-10
**Issue**: #66 (this PR's `Fixes #66` closes it — every acceptance item was already met by
earlier merged work; this is the layer `docs/testing.md` itself still listed "Not started")
**Design**: no separate design doc — `docs/testing.md`'s "app/api/**/route.ts" section scopes
this; this task is that scope, executed.

## Milestones

### 1. `lib/auth/current-member.ts` gets its first test

- **What**: the shared auth helper 5 of 11 route handlers delegate to had no test file at all.
- **Files**: `lib/auth/current-member.test.mts` (new).
- **Reuse**: pure `lib/` logic, no `app/` involved. 3 cases: session resolves; no session but
  host secret resolves to `HOST_PRESENCE`; neither resolves to `null`.
- **Done**: passes; the 5 delegating routes' own tests only need to check "does this route call
  the gate," not re-derive the gate's own correctness.

### 2. Auth-gate tests for the 8 applicable route handlers

- **What**: 3 with their own distinct implementation (`documents/route.ts`,
  `documents/[id]/route.ts`'s private `requireMember()`, `auth/yorkie-token/route.ts`'s own
  variant) plus 5 that delegate to `currentMember()`.
- **Files**: 8 new `*.route.test.ts` files, colocated with each `route.ts`.
- **Reuse**: `redirect()`/`notFound()` don't appear in this layer — every handler returns plain
  `NextResponse.json(...)`, so tests call the exported method and assert on `.status`.
- **Done**: 22 tests total. Caught a real gap doing the plan's own "spot-check a mutation"
  verification step: `documents/route.ts`'s GET test only covered the all-falsy case, so flipping
  `&&` to `||` didn't fail it — both operators agree when every input is false. Added the
  "succeeds when one side is true" case to both `documents/route.test.ts` and
  `documents/[id]/route.test.ts`, confirmed the mutation now fails, reverted.

### 3. Malformed-body precision, matching the client/server-component tiers' own established rule

- **What**: `documents/route.ts` and `documents/[id]/route.ts` each get the three-case shape
  (unauthenticated → 401 even with a malformed body; authenticated + malformed → 400). `chat/route.ts`
  gets the identified gap closed: its 400 for empty text + no attachment is currently accidental
  (relies on downstream `ChatValidationError`, no explicit body-shape check of its own) — now
  asserted directly.
- **Files**: same as milestone 2.
- **Done**: covered in the same test files/counts above.

### 4. Docs / issue sync

- **What**: `docs/testing.md`'s route-handler row and prose updated to "Landed", including the
  file-count correction (11, not "~10") and the `&&`/`||` mutation-testing lesson. `AGENTS.md` §7's
  TODO line repointed from "issue #65's own Gate checklist" (closing) to the new issue #92.
- **Files**: `docs/testing.md`, `AGENTS.md`.
- **Done**: no dead reference left once #65 closes.

## Acceptance

- [x] `pnpm test` — all 46 files / 488 tests pass (466 existing + 22 new), unmodified.
- [x] At least one gate test's mutation-catching verified for real (not just reasoned about) —
      found and fixed a real gap doing so.
- [x] `pnpm lint` / `pnpm build` clean.
- [x] `pnpm verify:docs` clean.
- [x] `docs/testing.md` and `AGENTS.md` §7 both updated.

## Cross-cutting

No production code changed except the two brief, reverted mutation checks used to verify test
sensitivity. Closes #66 via `Fixes` in the PR. #65 and #67 are closed separately (comment-only,
no code) once this PR is open — see issue #92 for what #65 split off before closing.

## Review

<!-- filled in at the end -->
