# Archive finished tasks and add version history to the SRS

**Created**: 2026-10-01
**Issue**: #23 (the FR/UC gap for version history)
**Design**: [`docs/design/version-history.md`](../../docs/design/version-history.md) for the SRS content; no new design doc — the audit edits existing ones.

## Milestones

### 1. Archive the six finished tasks

- **What**: move the pairs whose PRs are all merged (#115, #117, #118, #119/#120, #121, #122) out of `tasks/active/`.
- **Files**: `tasks/active/*` → `tasks/archive/2026/09/`, generated `tasks/README.md` and `tasks/archive/README.md`.
- **Reuse**: `pnpm tasks:archive <slugs>`; it fixes links and reindexes.
- **Done**: `pnpm verify:docs` is clean and nothing references `tasks/active/<archived slug>-`. Stale unticked boxes in upload-limit and version-history are resolved by running the checks, not by ticking them blind. "Worth extracting" items are not promoted here; they go in the PR description.

### 2. Version history in the SRS

- **What**: add UC-090 and an `FR-090-NN` table (§3.3.14), and update the diagram, overview table, §2.2, SOIR003 and UC-023's note.
- **Files**: `docs/SRS-ko.md`; then the `docs/design/version-history.md` Status line, the `docs/design/architecture.md` row that cites #23, and `ROADMAP.md`.
- **Reuse**: the UC-070 table format and the facts already in `docs/design/version-history.md`.
- **Done**: every new ID appears consistently across SRS, design docs and ROADMAP (grep); the team has agreed to the edit.

### 3. Doc-code drift audit — moved out of this task

Moved to its own issue and PR on 2026-10-01; the plan below is kept as its starting point.


- **What**: find claims in the docs that upstream/main code no longer backs, one part at a time.
- **Files**: docs under `docs/` by part (auth, editing, realtime, chat/files, UI/floating, infra/process); `docs/design/api.md` §1 for the endpoint catalog.
- **Reuse**: `typescript` compiler API (already installed) for a one-off extractor of client calls → route handlers → lib → Yorkie; its output goes to the sub-agents as input. Nothing else of this kind exists in `scripts/`, so no reuse claim there.
- **Done**: Sonnet 5.5 sub-agents, one per part (editing split in two), report claim → evidence → verdict; confirmed drift is fixed in English docs. Korean-doc drift is listed for the team. If the extractor proves useful, promoting it to a generated section plus a freshness check is a separate task.

## Acceptance

- [ ] `pnpm verify:docs`
- [ ] `pnpm comments --strict` (docs-only branch; any extractor script kept under the 30% budget)
- [ ] `pnpm lint && pnpm test && pnpm build`
- [ ] `git grep "tasks/active/<slug>-"` finds nothing for the six archived slugs
- [ ] The new SRS IDs are consistent across SRS, design docs and ROADMAP

## Cross-cutting

Touches the Korean SRS (agreed with the team, to be confirmed in the PR) and every doc the audit finds drifted. Each fix cites the code it was checked against.

## Review

Shipped: milestones 1 and 2. Milestone 3 (drift audit) was split off into its own issue and PR —
it is independent of the archive and the SRS change, and reviewing it apart keeps this PR small.
Drift found while doing milestone 2 (the version-history call path in the SRS §2.1 diagram and
`architecture.md` §3(c), and #23 still listed as open) was fixed here because it was the same change.
