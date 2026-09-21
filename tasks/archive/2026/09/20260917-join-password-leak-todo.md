# Join form leaks the workspace password via a GET fallback

**Created**: 2026-09-17
**Issue**: #99
**Design**: no design doc — a client-side hardening fix scoped to one component, not a module change.

## Milestones

### 1. Stop the native GET fallback from ever carrying the password

- **What**: remove `name` from the nickname/password `<input>`s in `app/join/join-form.tsx` so a pre-hydration native form submit has no named fields to serialize into a URL query string, regardless of why hydration hasn't finished.
- **Files**: `app/join/join-form.tsx`.
- **Reuse**: `nicknameRef`/`passwordRef` already existed (previously used only for focus management) — `join()` now reads values from them directly instead of `new FormData(form)`. This also matches the no-`name`, ref/controlled-state pattern every other form in the app (`document-actions.tsx`, `document-list.tsx`, `documents/[id]/editor.tsx`) already uses; `join-form.tsx` was the only outlier using `FormData`.
- **Done**: submitting the form before hydration produces a GET with no query string instead of one carrying `nickname`/`password`.

## Acceptance

- [x] `app/join/join-form.tsx` inputs carry no `name` attribute.
- [x] `join()` reads values via refs, not `FormData`; hydrated submit behavior (success, 400/401/409/500 handling, takeover dialog, focus management) unchanged.
- [x] Regression test added (`app/join/join-form.test.tsx`) asserting neither input has a `name` attribute.
- [x] `pnpm lint`, `pnpm test` (560 tests), `pnpm build` all pass.
- [x] Manual container check (`pnpm docker:up`): reproduce a pre-hydration submit and confirm the resulting request carries no query string.
- [x] `/code-review low` and `/simplify` run per `AGENTS.md` §6 pre-PR checklist.

## Cross-cutting

- No server-side change — `/api/workspace/join/route.ts` and `lib/auth/session-registry.ts` already just consume `{ nickname, password, force }` from the JSON body regardless of how the client assembled it.
- Satisfies no numbered FR directly; it closes a security gap adjacent to UC-020 (join flow) rather than adding behavior.
- Two alternative directions were considered and rejected — see the issue thread and this task's lessons doc for why.

## Review

Shipped as planned via PR #109 (merged). The container smoke test (a required CI check) grepped
for `name="nickname"` to detect the join screen and broke against this PR's own fix — caught and
corrected in a follow-up commit switching the marker to `autoComplete="nickname"`, confirming the
container check ran and the fix works end-to-end, not just in unit tests. These two boxes were
left unchecked after merge; backfilled now while archiving.
