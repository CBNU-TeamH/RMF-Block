# SRS-en.md as the agents' copy of SRS-ko.md, kept in sync by a required check

**Created**: 2026-10-01
**Issue**: #131
**Design**: no `docs/design/` doc — this adds a translated doc and a docs check, no runtime behaviour. The rules land in `AGENTS.md` §4/§5.

## Milestones

### 1. Translate `docs/SRS-en.md`

- **What**: an English translation of `docs/SRS-ko.md`, structure kept 1:1.
- **Structure rules**:
  - Same heading levels and order.
  - Same `|`-leading table lines.
  - Continuation lines stay non-pipe.
  - Mermaid node IDs are unchanged.
  - Requirement IDs are never translated.
  - UI literals that exist in code stay Korean with an English gloss.
  - Header note: Korean is canonical, and both files are edited in the same PR.
- **Files**: `docs/SRS-en.md`.
- **Reuse**: nothing to reuse; this is the first translated doc in the repo.
- **Done**: milestone 2's check passes on the pair.

### 2. Sync check

- **What**: `scripts/verify-srs-sync.mjs` fails when:
  1. `SRS-ko.md` changed against the merge base without `SRS-en.md`. An English-only change passes: it is a translation fix, and Korean is canonical.
  2. the sequence of requirement-ID definitions differs (UC headings, FR/NFR first cells, SIR/SOIR/HIR ID cells);
  3. the heading-level sequence differs, or the count of `|` lines between headings differs.
- **Files**:
  - `scripts/verify-srs-sync.mjs`
  - `scripts/lib/merge-base.mjs`, extracted from `scripts/comment-budget.mjs`
  - `scripts/comment-budget.mjs`
  - `package.json` (`verify:docs`)
  - `.github/workflows/ci.yml` (`check` job: `fetch-depth: 0` plus a step)
- **Reuse**: `resolveMergeBase()` from `scripts/comment-budget.mjs`, moved to `scripts/lib/` so both scripts share it.
- **Done**:
  - passes on the real pair;
  - fails on each of three mutated copies (FR row dropped, two UCs swapped, a heading level changed);
  - fails when `SRS-ko.md` changes alone (checked against `HEAD`); passes when `SRS-en.md` changes alone or both change.

### 3. Routing and rules

- **What**: agents are pointed at `SRS-en.md`; team agreement stays on `SRS-ko.md`; both are edited together.
- **Files**: `AGENTS.md` (overview, §2 Spec step, §4 routing, §5 language and agreed-docs bullets), `.github/pull_request_template.md`, `README.md`.
- **Reuse**: the existing §4 routing table and §5 bullets; no new section.
- **Done**: `pnpm verify:docs` is clean.

## Acceptance

- [x] `node scripts/verify-srs-sync.mjs` passes on the pair, and fails on each mutated copy (recorded in the PR)
- [x] CI's `lint · test · build` job runs the sync step (`--strict`, before install) — confirmed once the PR's CI run is green
- [x] `pnpm verify:docs`
- [x] `pnpm comments --strict`
- [x] `pnpm lint && pnpm test && pnpm build` — 628/628 tests

## Cross-cutting

- **SRS:** adds an English copy of the team-agreed SRS. The Korean text is not changed.
- **CI:** CI gains its first docs check. `verify:docs` as a whole stays out of CI; that question is noted on #128.
- **Section citations:** existing citations (`§4.1`, `§2.4`, …) keep pointing at `SRS-ko.md`, the canonical copy.

## Review

Shipped all three milestones. Changed on the way:
- **The changed-together rule is one-way.** It fails only when `SRS-ko.md` changes without `SRS-en.md`. An English-only change is a translation fix, and the symmetric rule would have failed this PR.
- **`--strict` fails on a missing merge base,** so the rule cannot silently skip in CI. This came from `/code-review low`.
- **Fenced blocks are excluded** from the heading and row counts, also from `/code-review low`.
- **The step runs before `pnpm install`,** from `/simplify`.

Cut: running all of `verify:docs` in CI. It has never run there, and the question is noted on #128.
