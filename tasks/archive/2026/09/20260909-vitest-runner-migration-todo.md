# Vitest runner migration (Phase 2, track C4)

**Created**: 2026-09-09
**Issue**: #66 (this task covers track C4 only — the runner migration and its dependencies)
**Design**: no new design doc. Follows Next 16's own guide at
`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`, adapted to this repo's existing
constraints (`pool: "forks"` for the `tmpdir()`/`process.env`-mutating tests, per-file
`// @vitest-environment` pragmas instead of config-side glob matching).

## Milestones

### 1. Validate `<dialog>.showModal()` under jsdom

- **What**: before treating `jsdom` as the settled dependency, confirm it actually supports
  `HTMLDialogElement.prototype.showModal()` — this gates every later DOM-touching track
  (`document-list.tsx`'s create-document dialog, `join-form.tsx`).
- **Files**: a throwaway `lib/_showmodal-smoke.test.mts`, deleted immediately after, never
  committed.
- **Reuse**: none — this is a one-off check, not reusable code.
- **Done**: outcome (jsdom / happy-dom / polyfill) recorded in this task's lessons file.

### 2. Install dependencies and add `vitest.config.mts`

- **What**: `vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `happy-dom` (milestone 1's
  fallback — jsdom failed the `showModal()` check), `@testing-library/react`,
  `@testing-library/dom`, `@testing-library/user-event`. New `vitest.config.mts` at repo root:
  `environment: "node"` default, `pool: "forks"` (existing tests write to `tmpdir()` and mutate
  `process.env` — sharing a worker would leak state), no worker-count tuning.
- **Files**: `package.json`, `vitest.config.mts` (new).
- **Reuse**: n/a — first Vitest setup in this repo.
- **Done**: `vitest.config.mts` loads; resolved dependency versions recorded in lessons.

### 3. Migrate all 31 `*.test.mts` files off `node:test`

- **What**: 30 files get a one-line import swap (`node:test` → `vitest`, `node:assert/strict`
  stays). One file, `lib/files/file-repository.test.mts`, additionally renames its `after` hook
  import/call to `afterAll` (Vitest doesn't export `after`).
- **Files**: all `*.test.mts` under `lib/` and `server/`.
- **Reuse**: mechanical, same pattern across all 30/31 files — no new abstraction needed.
- **Done**: every existing assertion passes unmodified under `vitest run`.

### 4. Wire the new runner into scripts and hooks

- **What**: `package.json`'s `"test"` becomes `"vitest run"`. `.githooks/pre-push` calls
  `node_modules/.bin/vitest run` instead of `node --test`, with its header comment updated (the
  "0 tests on local Node 22" paragraph no longer applies). `docs/conventions.md`'s "Node
  type-stripping constraint" section drops the now-inert `node --test` paragraph per its own
  existing forward-pointer.
- **Files**: `package.json`, `.githooks/pre-push`, `docs/conventions.md`.
- **Reuse**: n/a.
- **Done**: `pnpm test` is the only runner referenced anywhere in the repo (`.github/workflows/ci.yml`
  needs no edit — confirm, don't assume).

## Acceptance

- [x] `showModal()`/jsdom check resolved and recorded; smoke file deleted. (jsdom failed, happy-dom
      passed — swapped.)
- [x] All 7 dependencies installed, versions recorded in lessons. (happy-dom in place of jsdom.)
- [x] `vitest.config.mts` created with `environment: "node"`, `pool: "forks"`.
- [x] All 31 test files migrated (30 one-line swap, 1 `after`→`afterAll`); no assertion changed.
- [x] `pnpm test` (`vitest run`) is the only runner anywhere — `package.json`, `.githooks/pre-push`,
      CI all consistent (CI's `pnpm test` needed no edit).
- [x] `pnpm lint` clean (no ESLint global-injection needed).
- [x] `docs/conventions.md`'s type-stripping section trimmed.
- [x] `verify:fast` (`pnpm lint && pnpm test`) passes end-to-end; CI pending (PR not yet opened).

## Cross-cutting

Touches every existing test file's import line and the pre-push hook everyone relies on before
pushing — this is infrastructure, not a feature, so the risk is breaking CI/local verification for
the whole team if the migration is incomplete. No SRS requirement. Explicitly **out of scope**:
component tests, server-component Tier 1/2 tests, and `docs/testing.md` content — separate future
tracks under #66 (C2, and the rest of C4's own sub-bullets).

## Review

<!-- filled in at the end -->
