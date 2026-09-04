# Track D — wire Phase 1's rules into AGENTS.md — todo

**Created**: 2026-09-04
**Issue**: #65 (Phase 1, Track D — depends on Track A/B/C, all merged: #69, #70, #71, #72)
**Design**: none — this task edits `AGENTS.md` and `.github/pull_request_template.md` only,
pointing them at doc/script deliverables Tracks A–C already shipped.

## Milestones

### 1. `AGENTS.md` wiring

- **What**:
  - §2 (SDD workflow table): fold the comment-budget promotion review into step "5. Done," right
    before `pnpm tasks:archive` — reviewing "Worth extracting" belongs at the same wrap-up moment;
    a new table row would wrongly read as a hard gate on archiving.
  - Add `pnpm verify:docs` as a first action ahead of step 0 ("run this before touching
    anything"), not as a new numbered step.
  - New **"Run and verify"** section: *"changes to server startup, auth, or networking are
    verified with `docker compose up --build`, not `pnpm dev`."* — the exact wording drafted in
    `tasks/archive/2026/08/20260809-host-guest-entry-lessons.md`'s "Worth extracting," open since
    2026-07-28.
  - §4 doc-routing: point "code conventions" at `docs/conventions.md`. Do **not** add a
    `docs/testing.md` pointer for "test strategy" — per #65's own resolved scope correction, note
    explicitly that it doesn't exist yet and arrives with #66 (Phase 2), so the table states a
    known gap instead of promising a file.
  - §3 (coding principles): a pointer to `docs/conventions.md` only — same reasoning, no
    `testing.md` pointer.
  - §7 TODO: add a fourth item for the 2026-09-23 `comment-budget` promotion date
    (`scripts/lib/promotion-date.mjs`), worded like the existing three (names what it's blocked
    on: zero false positives, tracked in #65's own Gate checklist).
  - Short sub-agent delegation note: broad repo-wide fact-finding goes to an Explore-style
    sub-agent, small/localized edits are direct, judgement calls are never delegated — the
    pattern this whole Phase 1 effort already used. Worded tool-neutral (AGENTS.md's own header
    promises Claude/Cursor/Copilot parity), naming Claude Code's Explore agent as the concrete
    example rather than the only case.
- **Files**: `AGENTS.md`.
- **Reuse**: `docs/conventions.md`, `scripts/verify-docs.mjs`, `scripts/lib/promotion-date.mjs`
  (all shipped in #71); the exact "Run and verify" wording already drafted in an archived lessons
  file; issue #65's own Gate section for what the promotion item should name as its blocker.
- **Done**: diff-read against the pre-edit file — every existing line not named above is
  untouched; §7's existing three items still present, only additive.

### 2. PR template (C5b)

- **What**: add `pnpm comments` and `pnpm verify:docs` to the "Before opening this PR" checklist,
  alongside the existing `pnpm lint`/`test`/`build`, `/simplify`, `/code-review low` lines. Point
  the author checklist's §3/§5 reference at `docs/conventions.md` too, alongside the existing
  `AGENTS.md` reference — this is the check that couldn't exist before Track A shipped it.
- **Files**: `.github/pull_request_template.md`.
- **Reuse**: the template's own existing structure and phrasing style.
- **Done**: template still renders as valid markdown; every path it references now exists on
  `main` (unlike the brief #64-era regression where it pointed at files before they shipped).

### 3. Close the loop on `#65`

- **What**: comment on `#65` recording the two scope corrections filed at Phase 1's start
  (`scripts/tasks-archive.sh`'s referrer-rewriting was already done in PR #41, before #65 was
  written; `docs/testing.md` deferred to #66) so the issue reflects what actually shipped —
  matching the pattern already used for the #64 correction after CodeRabbit's review. Update
  #65's own tracklist to check off Track D's items once this PR is up.
- **Files**: none (GitHub only).
- **Reuse**: the exact pattern from the #64 CodeRabbit-driven correction comment.
- **Done**: comment posted, checklist updated, links resolve.

## Acceptance

- [ ] `AGENTS.md` diff is additive only — no unrelated line changed.
- [ ] §2 references `pnpm verify:docs` and folds the promotion review into step 5, not a new row.
- [ ] New "Run and verify" section present with the exact drafted wording.
- [ ] §4 points "code conventions" at `docs/conventions.md`; "test strategy" states the #66 gap
      explicitly rather than pointing at a file that doesn't exist.
- [ ] §7 has a fourth TODO item for the 2026-09-23 promotion date.
- [ ] Sub-agent delegation note added, worded tool-neutral.
- [ ] `.github/pull_request_template.md` includes `pnpm comments` and `pnpm verify:docs`, and a
      `docs/conventions.md` reference.
- [ ] Comment posted on `#65` with the two scope corrections; `#65` checklist updated for Track D.
- [ ] `pnpm verify:docs` run against the final state — no new dead-link findings introduced by
      this task's own edits (the 7 pre-existing ones are not this task's to fix).

## Cross-cutting

This is Phase 1's last track — once merged, all four tracks (`docs/conventions`,
`docs/presence-and-focus`, `chore/verify-scripts`, `chore/agents-md`) are on `main`. Phase 1's own
issue (`#65`) is not fully closed by this merge, though — its Gate section is measured against
real usage over the next 1–2 tasks, not at Track D's merge time. That measurement is out of this
task's scope.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
