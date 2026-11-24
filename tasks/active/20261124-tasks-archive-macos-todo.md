# tasks:archive on macOS: edit files without `sed -i`

**Created**: 2026-11-24
**Issue**: #233
**Design**: none — a repo script, nothing in `docs/design/` describes it. `scripts/detect-host-ip.sh` (the "Rewrite through a sibling temp file" block) is the precedent.

## Milestones

### 1. Rewrite in place through a temp file

- **What**: `pnpm tasks:archive <slug>…` runs to the end on macOS. Its two in-place edits — the moved files' relative links and the referrers' `tasks/active/` links — no longer use GNU `sed -i 'SCRIPT' FILE`, which BSD sed reads as a backup suffix.
- **Files**: `scripts/tasks-archive.sh` only (lines ~82 and ~96).
- **Reuse**: the temp-file-then-`mv` approach of `scripts/detect-host-ip.sh`. One small function in the script, called from both places; the `slug_re` `sed` reads stdin and writes stdout, so it stays.
- **Done**: with a `sed` on `PATH` that rejects `-i`, an archive run moves the pair, adds two directory levels to the relative links in both moved files, repoints a file that linked `tasks/active/<slug>-`, and regenerates both indexes.

## Test selection

- Vitest (logic / component / server / route): no change — the repo has no test harness for `scripts/*.sh` and this adds none for a 10-line fix.
- Browser E2E (`e2e/`): no change — no UI or server code.
- Container smoke (`.github/workflows/ci.yml`): no change — nothing touches startup, auth or networking.
- By hand, in a throwaway copy of the repo, recorded below: a strict `sed` shim that fails on any `-i`, then a scratch task pair run through `scripts/tasks-archive.sh`. Also `shellcheck` if it is installed, and `pnpm verify:docs`.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] No `sed -i` is left in `scripts/`.
- [ ] The archive run under the strict-`sed` shim ends with exit 0 and the three results above.
- [ ] Not run on a real Mac — the shim stands in for BSD sed's argument parsing, and the PR says so.

## Cross-cutting

No SRS, storage or API change. `AGENTS.md` §2 and `tasks/active/README.md` name `pnpm tasks:archive` but not how it edits files, so no doc goes stale.

## Review

Filled in at the end: what shipped, what was cut, what moved to another task.
