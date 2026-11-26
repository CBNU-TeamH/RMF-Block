# README: restructure around a quick start

**Created**: 2026-11-26
**Issue**: none
**Design**: none — host-facing docs only; `README.md` is the doc

## Milestones

### 1. Trim and current features

- **What**: drop detail the `.env` sample already explains, move the clone-to-release migration into `CONTRIBUTING.md`, and list the v0.4.0 features (tables, block selection, Markdown import, title search, who-is-where).
- **Files**: `README.md`, `README.ko.md`, `CONTRIBUTING.md`.
- **Reuse**: the existing sections and screenshots.
- **Done**: `pnpm verify:docs` clean.

### 2. Restructure

- **What**: intro → screenshots → features → five-step quick start → numbered setup steps → troubleshooting → upgrading (a link) → docs / contributing / team / license. Backup, upgrade and rollback move to a new `docs/upgrading.md`, with volume backup and restore commands no doc had before.
- **Files**: `README.md`, `README.ko.md`, `docs/upgrading.md`, and what linked into the old sections: `CONTRIBUTING.md`, `docs/adr/009-distribution-ghcr-image-tag-release.md`, `.github/workflows/release.yml` (release-notes text), `AGENTS.md` §4.
- **Reuse**: the rollback order already in the README; the WSL steps `scripts/detect-host-ip.sh` prints.
- **Done**: `pnpm verify:docs` clean; the backup and restore commands round-trip a scratch volume.

## Test selection

- Vitest (logic / component / server / route): no change — no code changes.
- Browser E2E (`e2e/`): no change — no behaviour changes.
- Container smoke (`.github/workflows/ci.yml`): no change — `docker-compose.yml` and the image are untouched; `release.yml` changes only the release-notes text.
- Commands and observed results: `pnpm verify:docs` clean. The backup and restore commands in `docs/upgrading.md`, run against a scratch volume with Docker 20.10 on macOS, restored its files (hidden ones and subdirectories included) and removed one added after the backup.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] `README.md` and `README.ko.md` keep the same headings and table lines (`pnpm verify:docs`).
- [x] Every link into a moved or renamed section resolves (`pnpm verify:docs`).

## Cross-cutting

- `README.ko.md` is now a natural Korean rendering rather than a line-by-line translation; AGENTS.md §5 already makes the English one win where they differ.
- Release notes say "Setup" instead of "Getting started" from the next release.

## Review

Shipped as planned. Not done here: new screenshots (the current ones predate tables and block selection); the team section names only the two maintainers' GitHub accounts; the PowerShell form of the backup commands was not run.
