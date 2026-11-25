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
- Commands and observed results:
  - A `sed` shim first on `PATH` that exits 1 on any `-i` argument, then a scratch task pair (a relative link to `docs/x.md` written two levels up in both files, plus a root file linking `tasks/active/<slug>-todo.md`) in a throwaway copy of `scripts/` and `tasks/`.
  - The previous script: `strict-sed: refusing -i`, exit 1.
  - The new script: exit 0; both moved files' relative links gained two more directory levels; the referrer now points at `tasks/archive/2026/11/…`; the archive index lists the task; no `*.tmp.*` left behind; the moved files stay `-rw-r--r--`.
  - `shellcheck`: not installed here, so not run. `bash -n scripts/tasks-archive.sh`: clean. `pnpm verify:docs`: clean.
  - Not run on a real Mac, and not with two slugs in one run (the loop is unchanged).
  - `/simplify`: no change (a 14-line diff, read directly rather than through four agents). `/code-review low`: one nit (the `mv` resets a file's mode to the umask default), declined — git tracks only the executable bit and the files are `.md`. The review also listed files outside this diff, so it is not evidence the diff was read closely.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] No `sed -i` is left in `scripts/` (the only hits are the two comments explaining why).
- [x] The archive run under the strict-`sed` shim ends with exit 0 and the three results above.
- [x] Not run on a real Mac — the shim stands in for BSD sed's argument parsing, and the PR says so.

## Cross-cutting

No SRS, storage or API change. `AGENTS.md` §2 and `tasks/active/README.md` name `pnpm tasks:archive` but not how it edits files, so no doc goes stale.

## Review

Shipped: `sed_in_place` in `scripts/tasks-archive.sh`, used at both call sites; it removes its temp file when `sed` fails, so a failed run leaves nothing for `git add` to pick up. Cut: nothing. Moved: nothing.

Only a real macOS run would show that BSD `sed` accepts the remaining plain `sed SCRIPT FILE` form; it is standard to both, so the risk is low, but it was not exercised.
