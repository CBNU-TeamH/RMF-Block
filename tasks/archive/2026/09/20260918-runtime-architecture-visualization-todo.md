# Runtime architecture visualization

**Created**: 2026-09-18
**Issue**: none
**Design**: [`docs/design/architecture.md`](../../../../docs/design/architecture.md)

## Milestones

### 1. Evidence-backed architecture source

- **What**: describe the repository's current runtime boundaries and primary collaboration path as Archify architecture JSON.
- **Files**: `docs/diagrams/runtime/rmf-block-runtime.architecture.json`
- **Reuse**: `docs/design/architecture.md`, the existing ADRs, and the implemented server/client entry points.
- **Done**: the source names only components and relationships supported by repository evidence and passes Archify showcase validation.

### 2. Portable visualization

- **What**: render the validated source as a self-contained interactive HTML artifact.
- **Files**: `docs/diagrams/runtime/rmf-block-runtime.html`
- **Reuse**: Archify's architecture renderer and delivery checks.
- **Done**: Archify delivery succeeds and browser evidence is collected from the delivered file.

## Acceptance

- [x] `node bin/archify.mjs validate architecture <source> --quality showcase --json` reports all showcase checks passing with no warnings.
- [x] `node bin/archify.mjs deliver architecture <source> <output> --quality showcase --json` succeeds.
- [x] The diagram clearly distinguishes direct Yorkie synchronization from App/WS Server traffic.
- [x] The generated HTML remains self-contained and usable without a running application.

## Cross-cutting

This adds documentation artifacts only. It does not change the agreed SRS, runtime code, dependencies, or deployment configuration.

## Review

Shipped an evidence-backed Archify source and a self-contained HTML viewer. The source links nine
runtime components to 12 paths/ranges at commit `d317ae1e3aa2435f107a2d82427fb1badb4b7537`.
Showcase validation and atomic delivery passed 9/9 checks with no errors or warnings. Automated
browser evidence was attempted and recorded as skipped because this environment has no Chrome or
Chromium; no perceptual visual-review claim is made.
