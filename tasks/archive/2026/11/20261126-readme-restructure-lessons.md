# README: restructure around a quick start — lessons

**Created**: 2026-11-26

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The README pair check in `pnpm verify:docs` compares only heading levels and table line counts, so `README.ko.md` can be a free Korean rendering without tripping it.
- The upgrade steps told hosts to back up the two volumes, but no doc said how.
- Four places pointed into README sections, by anchor or by name: `CONTRIBUTING.md`, ADR-009, the release-notes text in `release.yml`, and `.env.sample`'s "Open the ports". Renaming a heading means grepping for its words as well as its anchor.

## What we would do differently

- Nothing noted.

## Worth extracting

- None.
