# Repo doc consistency sweep + tasks/active archiving

**Created**: 2026-09-21
**Issue**: none — routine doc maintenance, prompted by a request to check whether `ARCHITECTURE.md`
and `docs/design/architecture.md` still match the code after #107–#110 landed
**Design**: no `docs/design/` doc — this task edits existing docs to match already-shipped code,
it does not design anything new.

Found by reading every doc under `docs/`, `ARCHITECTURE.md`, and `ROADMAP.md` end to end and
cross-checking each claim against the current code and GitHub issue state (`gh issue view`), after
confirming `upstream/main` already had PR #111 (the diagrams) and #107–#110 (the security fixes)
merged — this branch is fresh off that, not stacked on the now-redundant `docs/architecture-diagrams`
branch.

## Milestones

### 1. Architecture docs — the WS-upgrade auth gate is invisible in all three

`ARCHITECTURE.md`, `docs/design/architecture.md`, and both runtime diagrams describe the
Client↔App/WS-Server WebSocket boundary as carrying only `chat, session:revoked` traffic, with no
mention that both `/api/chat/ws` and `/api/workspace/ws` now reject the upgrade with a 401 unless
a live session or the host secret passes (ADR-006, #107), or of the revoke-race close from #110.

- **What**: add the auth-gate to the diagram edge/note in each of the three places.
- **Files**: `ARCHITECTURE.md`, `docs/design/architecture.md`,
  `docs/diagrams/runtime/rmf-block-runtime.architecture.json`,
  `docs/diagrams/runtime/rmf-block-runtime-detail.architecture.json`.
- **Reuse**: ADR-006 already has the full decision record; this only adds pointers to it plus the
  specific `isAuthenticatedSocket`/`isSessionValid` mechanics.
- **Done**: all three docs show that both WS upgrade paths gate entry, not just message content.
- **Caveat**: the `.architecture.json` files are "the editable Archify sources" per
  `docs/diagrams/harness/README.md` — edited by hand here since Archify itself isn't available in
  this environment. The corresponding `.html` files are **not regenerated** and now lag their own
  `.architecture.json` source; whoever has Archify access should re-run it before relying on the
  visual output.

### 2. Other stale doc references found in the same sweep

- **What**:
  - `docs/design/api.md` — add the missing ✅ status to `PATCH`/`DELETE /api/documents/:id`
    (both shipped since #82) and add the missing `GET /api/documents/:id` row.
  - `docs/conventions.md` — issue `#26`, cited as a bug deliberately left out of the five-shapes
    rulebook, is closed (fixed by #110). Removed it from that list and recomputed the "5 of 7 —
    71%" framing to 5 of 6 — 83%, noting in place why the count changed.
  - `docs/testing.md` — cited closed issue `#66` as the tracker for still-genuinely-open Tier 2
    work (confirmed the work itself isn't done: `app/(workspace)/layout.tsx`'s gate is still
    inline, not extracted). Filed a new issue (**#112**) and repointed both citations at it.
  - `ROADMAP.md` — added a dated note that Phase 2's UC-011 (guest kick, password change) has no
    route yet, while Phase 3/4 shipped substantially ahead of it — the doc's "technical
    dependency" ordering claim doesn't match observed ship order.
- **Files**: `docs/design/api.md`, `docs/conventions.md`, `docs/testing.md`, `ROADMAP.md`.
- **Reuse**: `gh issue view`/`gh issue list` to confirm issue state before editing any citation,
  rather than trusting the doc's own claim about what's open.
- **Done**: no doc cites a closed issue as if it tracks open work; `docs/conventions.md`'s
  fraction matches its own list.

### 3. Notion comparison — flagged, not fixed

Both Notion "요구사항 정의서" mirror pages still describe the Git-based persistence architecture
ADR-002 replaced with Yorkie+MongoDB on 2026-08-24 (27 mentions of "Git 저장소" each, last edited
2026-07-26/2026-08-02, before that change). Explicitly out of scope for this branch per direction
— Notion is not touched here.

### 4. Archive `tasks/active/` — all 4 pairs are done

- **What**: back-fill the two stale checkboxes + Review section in
  `20260917-join-password-leak-todo.md` (PR #109 merged; the checks did happen, the doc just
  never got updated post-merge), then run `pnpm tasks:archive` for all four slugs.
- **Files**: the 8 files under `tasks/active/` for `adr-maintenance`, `join-password-leak`,
  `unauthenticated-workspace-socket`, `ws-revoke-race`.
- **Reuse**: `scripts/tasks-archive.sh` — purely mechanical, moves files + rewrites links + rebuilds
  both indexes via `tasks:index`. No gate on checkbox state; confirmed via reading the script.
- **Done**: `tasks/active/` contains only this task's own pair; `tasks/README.md` and
  `tasks/archive/README.md` reflect the move.

## Acceptance

- [x] `ARCHITECTURE.md` shows the WS-upgrade auth gate
- [x] `docs/design/architecture.md` §3(b) points at ADR-006
- [x] Both runtime diagram `.architecture.json` files updated (line citations + access-control
      view + auth-gate note); HTML regeneration explicitly flagged as pending, not silently stale
- [x] `docs/design/api.md`'s Documents table has correct ✅ marks and the `GET` row
- [x] `docs/conventions.md` no longer cites closed `#26`; fraction recomputed
- [x] New issue #112 filed; `docs/testing.md` repointed at it
- [x] `ROADMAP.md` has the Phase 2/3/4 ordering caveat
- [x] `join-password-leak-todo.md` checkboxes/Review backfilled
- [x] All 4 `tasks/active/` pairs archived via `pnpm tasks:archive`
- [x] `pnpm verify:docs` passes
- [x] `pnpm lint && pnpm build` pass

## Cross-cutting

Doc-only change except for the one new GitHub issue (#112) — no code, no schema, no config
touched. Nothing here blocks on anything else in flight.

## Review

Shipped as planned: all seven doc fixes landed (`ARCHITECTURE.md`, `docs/design/architecture.md`,
both runtime diagram JSONs, `docs/design/api.md`, `docs/conventions.md`, `docs/testing.md` + new
issue #112, `ROADMAP.md`), the four already-finished `tasks/active/` pairs are archived, and this
task's own doc is being archived in the same pass — leaving a "move things to archive" task
sitting in `active/` once its own work is done would be its own small inconsistency.

`pnpm verify:docs`, `pnpm lint`, and `pnpm build` all pass. Nothing was cut. The one open item is
the runtime diagrams' `.html` output, which still reflects the pre-fix `.architecture.json` state
— regenerating it needs Archify, not available in this environment; now flagged in a new
`docs/diagrams/runtime/README.md` rather than only in this archived task doc.

`/simplify` ran before commit (4 parallel review agents — reuse, simplification, efficiency,
altitude). Fixed: an over-long mermaid edge label in `ARCHITECTURE.md`, a mid-paragraph ADR-006
insertion in `docs/design/architecture.md` that mixed two unrelated points, redundant phrasing in
`ROADMAP.md`'s new note, `ARCHITECTURE.md`'s Notes bullet re-deriving the revoke-race mechanism
instead of pointing at where it's already explained (`docs/conventions.md`), and the missing
`docs/diagrams/runtime/README.md` staleness marker. Skipped: extending `verify-docs` to check
cited-issue liveness automatically — real gap, out of scope, logged in this task's lessons doc
instead.
