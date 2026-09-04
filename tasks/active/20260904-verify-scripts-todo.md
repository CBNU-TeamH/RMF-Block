# Verify scripts — ownership, comment budget, hooks, `verify:docs`

**Created**: 2026-09-04
**Issue**: #65 (Phase 1, track C, of #67)
**Design**: no doc in `docs/design/` — this is tooling, not product behavior. Full derivation:
the harness review linked from #67.

Depends on tracks A and B, both merged (`#69`, `#70`): C10's ownership checker needs their final
`**Owns**` headers, C6 routes toward `docs/conventions.md`.

## Milestones

### 1. Ownership headers + checker (C10)

- **What**: a `**Owns**:` line at the top of each of the 5 design docs
  (`architecture.md`, `api.md`, `chat.md`, `document-editing.md`, `presence-and-focus.md`),
  naming the `lib/`/`app/` paths it covers — `presence-and-focus.md` already has one from track
  B; the other four don't yet. Then `scripts/verify-doc-ownership.mjs`: parse each doc's `**Owns**`
  paths, build an owner map against every top-level `lib/`/`app/` module, and report three
  verdicts — unowned (coverage hole), doubly-owned (duplication), owned-but-missing (dead
  reference).
- **Files**: `docs/design/architecture.md`, `docs/design/api.md`, `docs/design/chat.md`,
  `docs/design/document-editing.md` (add `**Owns**`); new `scripts/verify-doc-ownership.mjs`.
- **Reuse**: `presence-and-focus.md`'s `**Owns**` line as the pattern to match. Plain Node
  (`node:fs`, `node:path`), no new dependency — matches every other `.mjs` script in this repo.
- **Done**: run against the post-track-B state, `lib/focus` and `lib/documents` show zero
  coverage holes (the former via `presence-and-focus.md`, the latter via `document-editing.md`
  once it claims it). If either still shows a hole, that's a real gap to close, not a false
  positive to wave off.

### 2. `scripts/comment-budget.mjs` (C6)

- **What**: comment ratio for `.ts`/`.tsx` files changed against the merge base only — a
  **routing signal, not a gate**: over 25% prints "move this to `docs/`," never fails the build.
  Merge-base resolution prefers `upstream/main`, falls back to `origin/main`, falls back to local
  `main` — locally `origin` is the fork, `upstream` is canonical; in CI, `origin` *is* canonical.
  Separately prints a promotion-due notice once today passes 2026-09-23.
- **Files**: new `scripts/comment-budget.mjs`; `"comments": "node scripts/comment-budget.mjs"` in
  `package.json`.
- **Reuse**: the line-based comment counter already used to measure this repo's ratio throughout
  Phase 1's own planning (`//`, `/* */` state machine — no need to parse strings/templates).
- **Done**: run against a real diff, spot-check one file's reported ratio by hand.

**Known constraint, not a blocker**: `.github/workflows/ci.yml`'s `actions/checkout@v4` calls set
no `fetch-depth`, so CI clones default to depth 1 — no history for a merge-base once this
promotes to a CI check. Note it in the script's own header and in the §7 TODO track D adds, so
it's not a surprise on 2026-09-23.

### 3. Hooks, `distDir` split, `verify:docs` (C8)

- **What**:
  - `.githooks/pre-commit` — staged-file lint + comment budget, target ~2s.
  - `.githooks/pre-push` — `pnpm test && pnpm build`.
  - `"prepare": "git config core.hooksPath .githooks || true"` in `package.json`. The `|| true`
    is required: the Dockerfile's `deps` and `prod-deps` stages run `pnpm install
    --frozen-lockfile` (which triggers `prepare`) after copying only `package.json`,
    `pnpm-lock.yaml`, `patches/` — no `.git` (also excluded via `.dockerignore`). Without the
    guard, the image build fails.
  - `next.config.ts`: `distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next"`.
    `dev` sets `NODE_ENV=development` explicitly, `start` sets `production`, `build` sets
    neither (falls to `.next`, matching the Dockerfile's `COPY --from=build /app/.next`). Fixes
    the known regression where `pnpm build` then `pnpm dev` fails until `.next` is cleared by
    hand.
  - `scripts/verify-docs.mjs`: (a) run milestone 1's ownership checker; (b) run `bash
    scripts/tasks-index.sh`, then check `tasks/README.md`/`tasks/archive/README.md` are
    unchanged — report only, exit 1, tell the dev to run `pnpm tasks:index`, never auto-mutate a
    tracked file inside a verify script; (c) dead-link check over `docs/**/*.md`, `AGENTS.md`,
    `tasks/active/*.md` — extract markdown links and backtick-quoted repo-relative paths,
    `fs.existsSync` each, skip anchors and external URLs; (d) the same 2026-09-23 promotion
    notice as milestone 2, shared via a small `scripts/lib/promotion-date.mjs` helper rather than
    duplicated. Exit 1 if (a) or (c) fail. `"verify:docs": "node scripts/verify-docs.mjs"` in
    `package.json`.
- **Files**: `.githooks/pre-commit`, `.githooks/pre-push` (new), `package.json`, `next.config.ts`,
  new `scripts/verify-docs.mjs`, new `scripts/lib/promotion-date.mjs`.
- **Reuse**: `scripts/tasks-index.sh`'s own idempotency pattern (already proven in Phase 0 and
  tracks A/B) for check (b).
- **Done**: `git config core.hooksPath` is `.githooks` after `pnpm install`; a trivial staged
  change triggers pre-commit in under ~2s; `pnpm verify:docs` run against current state reports
  clean; a deliberately broken link in a scratch copy is caught, not just "doesn't crash";
  `pnpm build` then `pnpm dev` locally — `.next` and `.next-dev` stay separate and dev still
  boots; the Docker image (`pnpm docker:up`) still builds, proving the `|| true` guard matters.

### Explicitly out of scope

`scripts/tasks-archive.sh`'s referrer-rewriting — already implemented since PR #41, confirmed by
reading the script before Phase 1 started. Not touched here beyond the `simple:` rename track B
already did.

## Acceptance

- [ ] All 5 design docs carry a `**Owns**` line; `verify-doc-ownership.mjs` reports zero holes,
      zero duplicates, zero dead references against current `main`.
- [ ] `node scripts/comment-budget.mjs` runs against a real diff and produces sane per-file
      output.
- [ ] `pnpm install` sets `core.hooksPath`; pre-commit and pre-push fire.
- [ ] `pnpm docker:up` still builds the image.
- [ ] `pnpm build` then `pnpm dev` no longer requires clearing `.next` by hand.
- [ ] `pnpm verify:docs` catches a deliberately introduced broken link.
- [ ] `bash scripts/tasks-index.sh` is idempotent.

## Cross-cutting

- **Track D depends on this**: `AGENTS.md`'s new "Run and verify" section and §7 promotion-date
  entry both reference commands this task creates.
- No SRS requirement covers this; nothing in `docs/SRS-ko.md` changes.

## Review

Filled in at the end.
