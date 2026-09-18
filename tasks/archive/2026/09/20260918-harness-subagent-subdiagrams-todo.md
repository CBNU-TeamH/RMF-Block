# Harness sub-agent subdiagrams

**Created**: 2026-09-18
**Issue**: none
**Design**: No separate design document; the subdiagrams expand the existing harness overview from repository rules in `AGENTS.md`, `skills/README.md`, hooks, scripts, and CI configuration.

## Milestones

### 1. Model review-agent fan-out

- **What**: Show the Simplify sub-agent, five parallel code-review agents, confidence filtering, and PR/issue handoff.
- **Files**: `docs/diagrams/harness/subdiagrams/code-review-fanout.architecture.json`, `docs/diagrams/harness/subdiagrams/code-review-fanout.html`
- **Reuse**: The review-lens facts already verified in `skills/README.md`.
- **Done**: Every documented reviewer role and model-inheritance constraint is visible.

### 2. Model docs and SDD delegation

- **What**: Separate the docs/harness audit-revise loop from the main-agent/Explore delegation loop.
- **Files**: `docs/diagrams/harness/subdiagrams/docs-review-loop.*`, `docs/diagrams/harness/subdiagrams/sdd-delegation.*`
- **Reuse**: `AGENTS.md` delegation rules, task lifecycle, and the `AGENTS.md` revise-target guard.
- **Done**: The diagrams distinguish delegated fact-finding from non-delegated judgement and show the docs promotion loop.

### 3. Model deterministic gates and index the set

- **What**: Show Git hooks, local checks, Docker, and CI as deterministic automation with no sub-agent fan-out, and provide a clickable index.
- **Files**: `docs/diagrams/harness/subdiagrams/quality-ci-gates.*`, `docs/diagrams/harness/README.md`
- **Reuse**: Existing hook scripts and GitHub Actions workflow.
- **Done**: Readers can open every detailed HTML from one index and can tell agentic review from deterministic enforcement.

## Acceptance

- [x] Four detailed subdiagrams exist under `docs/diagrams/harness/subdiagrams/`.
- [x] Code review shows all five documented parallel reviewer roles and the confidence-80 filter.
- [x] Docs review shows audit, deterministic checks, revise, and the explicit `AGENTS.md` target.
- [x] SDD delegation shows Explore-style fact-finding and retains judgement in the main agent.
- [x] Quality/CI explicitly states that hooks, tests, Docker, and Actions are not sub-agents.
- [x] Every HTML passes Archify showcase validation with 9/9 checks.

## Cross-cutting

Documentation-only. The diagrams explain existing behavior and do not change skills, agent configuration, hooks, CI, runtime, or agreed requirements.

## Review

- Delivered four standalone HTML artifacts with editable JSON specifications.
- Added a harness index linking the overview and every subdiagram.
- Archify deterministic delivery passed 9/9 showcase checks with zero errors and warnings for all four artifacts.
- Automated browser evidence was skipped because Chrome/Chromium is unavailable in this environment; each artifact has an artifact-bound skip receipt.
