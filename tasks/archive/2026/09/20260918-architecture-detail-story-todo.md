# Architecture detail and guided story

**Created**: 2026-09-18
**Issue**: none
**Design**: [`docs/design/architecture.md`](../../../../docs/design/architecture.md)

## Milestones

### 1. Expand runtime modules

- **What**: split the browser and app-server nodes into their implemented runtime responsibilities without exceeding Archify's 12-node showcase scope.
- **Files**: `docs/diagrams/runtime/rmf-block-runtime-detail.architecture.json`
- **Reuse**: the existing evidence-backed architecture source and its pinned repository revision.
- **Done**: the diagram distinguishes editing, presence/focus, routing, domain services, sessions, broadcasts, and both persistence owners.

### 2. Enable guided playback

- **What**: enable trace motion and rewrite guided chapters as ordered, directly connected paths.
- **Files**: `docs/diagrams/runtime/rmf-block-runtime-detail.architecture.json`, `docs/diagrams/runtime/rmf-block-runtime.html`
- **Reuse**: Archify's `meta.animation` and `meta.views` runtime capabilities.
- **Done**: the delivered HTML contains trace-enabled motion and four guided stories.

## Acceptance

- [x] Archify showcase validation passes 9/9 checks with no errors or warnings.
- [x] Atomic HTML delivery succeeds for the updated frozen source.
- [x] Every guided story uses existing stable node IDs in an intentional path order.
- [x] No runtime code, dependency, or agreed SRS content changes.

## Cross-cutting

Documentation artifacts only. Per the user's request, repository-wide verification and commits are out of scope.

## Review

Shipped a 12-node detailed runtime map with 21 source references and five ordered guided stories.
`meta.animation: "trace"` enables the viewer's Live / Still control and bounded Story playback.
Showcase validation and delivery passed 9/9 checks with no errors or warnings. Automated browser
evidence remains skipped because this environment has no Chrome or Chromium; the user owns the
perceptual review. No repository-wide verification or commit was run, as requested.
