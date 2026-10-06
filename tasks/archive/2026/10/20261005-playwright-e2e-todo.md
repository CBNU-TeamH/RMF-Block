# A Playwright E2E layer, and the IME replay race it exists to reach

**Created**: 2026-10-05
**Issue**: #61, #52
**Design**: [`docs/testing.md`](../../../../docs/testing.md) gains the layer; [`docs/design/document-editing.md`](../../../../docs/design/document-editing.md) "Behaviour of the textarea surface" holds the composition rule #52 changes.

#61's own trigger is met: the editor's screen contract has stopped moving, and #52 cannot be
measured any other way. #52 is the first thing the layer measures. The user also asked for the CI
jobs to be merged (same checks, fewer jobs), and E2E has to land in one of them anyway.

## Milestones

### 1. The E2E layer

- **What**: `pnpm e2e` runs Playwright (Chromium) against a running stack; one two-client check that an edit in one browser shows in the other.
- **Files**: `playwright.config.ts`, `e2e/helpers.ts`, `e2e/sync.e2e.ts`, `package.json`, `.gitignore`, `eslint.config.mjs`.
- **Reuse**: the join and document APIs (`POST /api/workspace/join`, `POST /api/documents`); the editor's `[data-block-id]` rows. Playwright directly, not the `webapp-testing` skill — no Python in a pnpm repo. `.e2e.ts` keeps Vitest's default glob away, so `vitest.config.mts` is untouched.
- **Done**: `sync.e2e.ts` passes against the container.

### 2. Reproduce #52 end to end

- **What**: A composes `안` at the end of `abc` (CDP `Input.imeSetComposition`), B types `X` at the start, A confirms (`Input.insertText`). Both screens must agree.
- **Files**: `e2e/ime-replay.e2e.ts`.
- **Done**: fails against the current code, with the diverging values recorded in the lessons.

### 3. Fix #52

- **What**: queued remote edits are mapped through the open composition, the diff baseline tracks Yorkie instead of copying the DOM, and `compositionend` flushes before it commits.
- **Files**: `app/(workspace)/documents/[id]/text-block.tsx`, `text-block.test.tsx`.
- **Reuse**: `diffRange` and `shiftCaret` (`lib/blocks/text-surface.ts`); a real `yorkie.Document` in the test, seeded the way `lib/blocks/operations.test.mts` does.
- **Done**: the component test (textarea equals the block's live Yorkie text after a composition with remote edits on both sides of it) and `ime-replay.e2e.ts` both pass.

### 4. CI: three jobs

- **What**: `lint · test · build` unchanged; `container smoke test` runs Yorkie invariants, the curl smoke and E2E (`continue-on-error` until promoted) on one stack; `docs` runs verify docs and the comment budget. Same checks, two fewer jobs.
- **Files**: `.github/workflows/ci.yml`, `AGENTS.md` §6.
- **Done**: three jobs on the PR. `yorkie invariants` comes out of ruleset 20220373 right before merge (admin, on the user's word).

### 5. Docs

- **Files**: `docs/testing.md` (fifth layer), `docs/design/document-editing.md` (composition rule), `.claude/skills/README.md` (`webapp-testing` row).

## Acceptance

- [x] `ime-replay.e2e.ts` red before the fix, green after; `sync.e2e.ts` green — against the container
- [x] Component test fails without the fix; existing text-block / text-surface tests pass
- [x] eslint on changed files, `tsc --noEmit`, `pnpm verify:docs`
- [ ] By hand (user): two browsers with a Korean IME, one composing while the other edits earlier in the same block → same text on both

## Cross-cutting

- FR-022 (block editing), NFR-REL-001 (resynchronisation): wrong text committed to the shared document is the failure mode #52 names.
- ADR-008 lists this case as "not yet measured"; ADRs are not edited — the design doc and this task record the measurement.
- The required-check rename touches the branch ruleset, not just YAML.

## Review

- **Shipped**: `pnpm e2e` (Playwright 1.61.0, Chromium) with two checks — two-client sync, and #52's composition race through CDP. #52 measured red (`Xabc안` on A, `Xab안c` in Yorkie), fixed in `patchRange` / `onCompositionEnd`, pinned by a component test that fails without the fix; both E2E checks green against `pnpm dev` and against the container.
- **CI**: five jobs → three (`lint · test · build`, `container smoke test` with invariants + smoke + E2E, `docs`). Still to do at merge: remove `yorkie invariants` from ruleset 20220373's required checks (admin, on the user's word).
- **Docs**: `docs/testing.md` fifth layer; `document-editing.md` composition rule; AGENTS.md §6, the PR template and the docs naming old jobs; `webapp-testing` dropped from the skills list.
- **Review (Sonnet)**: `/code-review` found an edit spanning the composition deleted the composed text — fixed, with a test that fails on the earlier version; the fixed sleep in `ime-replay.e2e.ts` became a third, non-composing client to wait on; the Chromium install can no longer fail the required job. `/simplify`: dropped the default `retries`, the Playwright cache step and the test document counter, trimmed CI comments. Not taken: a `twoPeers` helper (two uses only).
- **By hand**: still open (two real browsers, a real Korean IME).
