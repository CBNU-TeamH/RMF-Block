# Harness architecture visualization

**Created**: 2026-09-18
**Issue**: none
**Design**: No separate design document; this task visualizes the repository workflow already defined by `AGENTS.md`, `skills/README.md`, task scripts, hooks, and CI configuration.

## Milestones

### 1. Separate runtime and harness artifacts

- **What**: Group the existing runtime diagram and the new harness diagram under dedicated directories.
- **Files**: `docs/diagrams/runtime/`, `docs/diagrams/harness/`
- **Reuse**: The accepted runtime Archify artifact already under `docs/diagrams/`.
- **Done**: Runtime artifacts remain intact under `docs/diagrams/runtime/`, while harness artifacts live under `docs/diagrams/harness/`.

### 2. Model the repository harness

- **What**: Create an evidence-backed, detailed Archify architecture model covering guidance, SDD task lifecycle, local checks, review skills, PR governance, and CI.
- **Files**: `docs/diagrams/harness/rmf-block-harness.architecture.json`
- **Reuse**: `HARNESS-ARCHITECTURE.md` as a visual seed and committed repository files as authoritative evidence.
- **Done**: The model has a readable primary path, supporting cross-links, evidence references, and story views.

### 3. Deliver the interactive diagram

- **What**: Render a standalone HTML diagram with trace-driven story playback.
- **Files**: `docs/diagrams/harness/rmf-block-harness.html`
- **Reuse**: The installed Archify renderer and viewer runtime.
- **Done**: Archify validation accepts the artifact with 9/9 quality checks and no warnings or errors.

## Acceptance

- [x] Runtime and harness diagrams are separated into their own directories.
- [x] The harness diagram reflects committed repository evidence rather than only the older Mermaid draft.
- [x] The diagram explains authoring, document checks, code checks, container validation, and PR/CI flow.
- [x] Play Story exposes up to five ordered trace views.
- [x] The final standalone HTML passes Archify showcase validation with 9/9 quality checks.

## Cross-cutting

This is documentation-only. It does not change requirements, runtime behavior, hooks, or CI policy. The untracked root-level `HARNESS-ARCHITECTURE.md` remains untouched.

## Review

Shipped a 12-module, evidence-backed harness diagram with five trace stories and reorganized the accepted runtime artifacts under `docs/diagrams/runtime/`. The first wide layout passed topology validation but failed the standalone viewer's 1440px readability gate, so the same modules were reflowed into three rows. Automated browser evidence was skipped because Chrome/Chromium is unavailable in this environment; deterministic delivery passed 9/9 with no errors or warnings.
