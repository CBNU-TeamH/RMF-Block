# Harness review lenses

**Created**: 2026-09-18
**Issue**: none
**Design**: No separate design document; this update expands the existing harness diagram using the review workflow defined in `skills/README.md`.

## Milestones

### 1. Split the review stage

- **What**: Replace the aggregated AI review component with explicit Simplify, Code Review, and Docs Review lenses.
- **Files**: `docs/diagrams/harness/rmf-block-harness.architecture.json`
- **Reuse**: The existing 12-node harness topology and repository evidence links.
- **Done**: Each review lens shows its timing, purpose, evidence, and handoff without exceeding 12 primary nodes.

### 2. Expand guided stories and explanations

- **What**: Make the five story chapters explain SDD entry, docs review, simplify, code review, and release gating.
- **Files**: `docs/diagrams/harness/rmf-block-harness.architecture.json`
- **Reuse**: Archify guided views and trace playback already enabled in the artifact.
- **Done**: Each review chapter follows authored direct relationships and the cards explain the repository-specific review rules.

### 3. Redeliver the standalone artifact

- **What**: Regenerate the interactive harness HTML from the updated evidence-backed specification.
- **Files**: `docs/diagrams/harness/rmf-block-harness.html`
- **Reuse**: The existing Archify delivery pipeline and browser-evidence sidecar.
- **Done**: Showcase validation passes 9/9 with no errors or warnings.

## Acceptance

- [x] `/simplify`, `/code-review low`, and docs review are separate components.
- [x] The diagram documents free-check ordering, Sonnet usage, the five-reviewer/80-point filter, and the `AGENTS.md` target for revision.
- [x] Five guided stories expose the detailed review lenses.
- [x] The standalone HTML passes Archify showcase validation with 9/9 checks.

## Cross-cutting

Documentation-only. No runtime, hook, CI, requirement, or skill policy changes are made; the diagram only explains current committed policy.

## Review

Replaced the aggregated AI review box with three evidence-backed lenses and rewrote the guided stories around their actual handoffs. Git hook details were folded into Local Quality so the diagram remains at 12 primary nodes. Delivery passed 9/9 with no errors or warnings; automated browser evidence was skipped because Chrome/Chromium is unavailable.
