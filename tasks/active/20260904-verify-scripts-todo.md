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
  change triggers pre-commit in under ~2s; a deliberately broken link in a scratch copy is caught,
  not just "doesn't crash"; `pnpm build` then `pnpm dev` locally — `.next` and `.next-dev` stay
  separate and dev still boots; the Docker image (`pnpm docker:up`) still builds, proving the
  `|| true` guard matters.

  **`pnpm verify:docs` reporting clean was revised.** Nine findings survive against current
  `main` — none introduced by this task. Full breakdown in Review below; the short version is
  that the ownership checker's coverage holes are expected non-blocking noise (see milestone 1),
  and the dead-link checker's nine hits are pre-existing content the checker has no business
  silently rewriting.

### Explicitly out of scope

`scripts/tasks-archive.sh`'s referrer-rewriting — already implemented since PR #41, confirmed by
reading the script before Phase 1 started. Not touched here beyond the `simple:` rename track B
already did.

## Acceptance

- [x] All 5 design docs carry a `**Owns**` line; `verify-doc-ownership.mjs` reports zero
      duplicates and zero dead references against current `main`. Coverage holes are not
      required to be zero — eleven exist honestly today (`app/join/*`, four API routes, three
      shell files) and forcing that to zero is out of this task's scope; the script reports them
      without failing.
- [x] `node scripts/comment-budget.mjs` runs against a real diff and produces sane per-file
      output. Verified against a wider historical diff too (16 files over budget between
      `upstream/main~5` and `HEAD`), not just the current clean state.
- [x] `pnpm install` sets `core.hooksPath`; pre-commit and pre-push fire — confirmed with a real
      `git commit` (`c0d74b9`), not a dry run.
- [x] `pnpm docker:up` still builds the image — confirmed via a full container rebuild, app
      served `Ready on http://0.0.0.0:3000` with the `.next` distDir present and `.next-dev`
      absent, exactly as designed.
- [x] `pnpm build` then `pnpm dev` no longer requires clearing `.next` by hand. Confirmed the
      `next build` half directly (Docker's `node:24-alpine` build stage). Could not confirm the
      `pnpm dev` half locally — this machine's Node is 22, and the custom server's native
      `.mts` execution needs 24 — but the config logic itself was verified in isolation under
      all three `NODE_ENV` states, and the Dockerfile reasoning it depends on was read and
      confirmed, not assumed.
- [x] `pnpm verify:docs` catches a deliberately introduced broken link — confirmed with a real
      scratch edit to `docs/conventions.md`, restored after.
- [x] `bash scripts/tasks-index.sh` is idempotent.

## Cross-cutting

- **Track D depends on this**: `AGENTS.md`'s new "Run and verify" section and §7 promotion-date
  entry both reference commands this task creates.
- **A separate tiny branch, not Track D, fixes one of the nine `verify:docs` findings**:
  `AGENTS.md:62`'s doc-routing row links to the `tasks/` directory, then names its two
  subdirectories in prose without repeating the `tasks/` prefix — reads fine in context, but
  relies on context a per-line checker can't have. One-line prose fix, unrelated to anything
  Track D actually changes in that file, so it doesn't need to wait for Track D's PR.
- No SRS requirement covers this; nothing in `docs/SRS-ko.md` changes.

## Review

Shipped all three milestones. The ownership checker (milestone 1) is covered in its own commit
message in detail — three real bugs found by running it, not by reading the code. Two more things
worth recording here:

**`verify:docs` reports nine findings against current `main`, none introduced by this task.**
Doc ownership: 11 coverage holes, already accounted for as non-blocking in milestone 1's
acceptance. Dead links: 9, all pre-existing —
- `docs/conventions.md`: one `./ws-hub.mts` mention is an illustrative import-specifier example
  quoted verbatim from `server/index.mts`'s real source; "fixing" it would mean misquoting real
  code to satisfy a doc-audit tool. Left as a documented, accepted limitation.
- `AGENTS.md:62`: `active/`/`archive/` read in isolation, missing the `tasks/` context the
  preceding link establishes. Handed to a separate small branch (see Cross-cutting) rather than
  either bundled into this PR (out of Track C's file scope) or left for Track D (unrelated to
  what Track D actually changes in that file).
- `docs/HOST-GUEST-ENTRY-ko.md`: six mentions, all inside "here's what used to be here, before
  the auth-gate restructuring" narrative — the doc says so directly (*"app/page.tsx는
  사라졌고"*). A checker that only asks "does this path exist" cannot distinguish a present-tense
  claim from a past-tense one; building that distinction is out of scope for what this task asks
  for, and the document itself predates this work and wasn't touched, matching `AGENTS.md` §5's
  spirit even though this specific doc isn't one of the ones that section names.

Decided with the user rather than silently: leave these as documented, not force `verify:docs`
to report clean by either suppressing real findings or editing a doc this task has no standing to
change.

**The distDir split (milestone 3) could only be half-verified locally**, for a reason worth
recording precisely: this machine runs Node 22, and the custom server's native `.mts` execution
requires Node 24 (confirmed: `ERR_UNKNOWN_FILE_EXTENSION` when attempting `node server/index.mts`
directly). The production half was still fully verified — a real `pnpm docker:up` build, on the
actual `node:24-alpine` image, produced `.next` and not `.next-dev`, matching the design. The
`pnpm dev` half rests on the `NODE_ENV=development` conditional already being proven correct in
isolation, plus reading (not assuming) that `dev`/`start` set `NODE_ENV` explicitly. Also
recorded here because it nearly caused a real mistake: the temptation to "fix" the apparent
inconsistency with `server/index.mts`'s own `dev` flag (`NODE_ENV !== "production"`, vs. this
config's `=== "development"`) would have broken the Dockerfile's actual build path, which runs
`pnpm build` with `NODE_ENV` unset — caught by reading the Dockerfile stage order before editing,
not after.
