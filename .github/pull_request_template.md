## Summary

## Why

## Linked Issues

Task doc: `tasks/active/`
Fixes #

## Author checklist

- [ ] I searched existing issues and PRs and confirmed this is not a duplicate.
- [ ] Changes follow [`AGENTS.md`](../AGENTS.md) §3 and §5 and [`docs/conventions.md`](../docs/conventions.md); any deviation is explained in *Why* above.
- [ ] Agreed docs (`docs/SRS-ko.md`) are unchanged, or the team already agreed to the change — and `docs/SRS-en.md` carries the same change, translation reviewed.
- [ ] Owning docs (see the owning-docs reminder comment): updated · or not needed because: …
- [ ] I revisited [test selection](../docs/testing.md#select-tests-for-each-change) for the final behavior; required new/updated tests are included in this PR, and coverage or a concrete reason no change is needed is recorded below.
- [ ] If AI tools assisted with this PR, I noted where in *Notes for Reviewers* below.

## Verification

### Test selection

For each layer, name the existing coverage, new/updated test paths, or why no change is needed.
Record commands and outcomes in the sections below; running a suite alone does not show that
it covers the changed behavior.

- Vitest (logic / component / server / route):
- Browser E2E:
- Container smoke:

### Automated

All run on this PR.

- [ ] `lint · test · build` — ✅
- [ ] `container smoke test` — ✅ (Yorkie invariants and the smoke test; or explicit skip reason below)
- [ ] its E2E step — passed · or failed / skipped, and why: (non-blocking until promoted, so a green job does not mean E2E passed)
- [ ] `docs` — ✅ (doc checks and the comment budget; a red budget step means this PR grew comments in a file over 30% — see `docs/conventions.md`)

Skip reason (if applicable):

### Before opening this PR

Which checks were actually run — not whether the diff was read carefully.
[`.claude/skills/README.md`](../.claude/skills/README.md) says what each one is, and in which order.

- [ ] `pnpm lint` / `pnpm test` / `pnpm build` locally
- [ ] `pnpm comments` / `pnpm verify:docs` locally
- [ ] `/simplify` — ran · or not applicable because:
- [ ] `/code-review low` — ran · or not applicable because:

Cost guidance and how to verify the review agents' models:
[`.claude/skills/README.md`](../.claude/skills/README.md), "Model".

Findings raised but **not fixed here** — filed as issues rather than dropped:

### By hand

Anything CI cannot reach (LAN, multiple devices, browsers):

## Risk Assessment

- User-facing risk:
- Data/security risk:
- Rollback plan:

## Notes for Reviewers

- UI changes (screenshots/gifs if applicable):
- Follow-up work (if any):
