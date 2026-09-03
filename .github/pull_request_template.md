## Summary

## Why

## Linked Issues

Task doc: `tasks/active/`
Fixes #

## Author checklist

- [ ] I searched existing issues and PRs and confirmed this is not a duplicate.
- [ ] Changes follow [`AGENTS.md`](../AGENTS.md) §3 and §5; any deviation is explained in *Why* above.
- [ ] Agreed docs (`docs/SRS-ko.md`) are unchanged, or the team already agreed to the change.
- [ ] If AI tools assisted with this PR, I noted where in *Notes for Reviewers* below.

## Verification

### Automated

Both run on this PR.

- [ ] `lint · test · build` — ✅
- [ ] `container smoke test` — ✅ (or explicit skip reason below)

Skip reason (if applicable):

### Before opening this PR

Which checks were actually run — not whether the diff was read carefully.
[`skills/README.md`](../skills/README.md) says what each one is, and in which order.

- [ ] `pnpm lint` / `pnpm test` / `pnpm build` locally
- [ ] `/simplify`, **from a Sonnet session** — ran · or not applicable because:
- [ ] `/code-review low`, **from a Sonnet session** — ran · or not applicable because:

Sub-agents inherit the session's model, so an Opus session runs the review on Opus and
spends the saving that `low` exists to make.

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
