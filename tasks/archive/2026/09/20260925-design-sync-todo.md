# Sync the app's components to Claude Design

**Created**: 2026-09-25
**Issue**: none
**Design**: none — tooling, not app behaviour. Inputs live in `.design-sync/`; the Claude Design project is https://claude.ai/design/p/8cd19d73-acf0-4cef-9b0e-995d58f947fa

## Milestones

### 1. Bundle and preview every presentational component

- **What**: `/design-sync` uploads 19 app components (bundle, `.d.ts`, previews) so Claude Design's agent designs with them, as groundwork for a redesign that keeps the `sky` primary.
- **Files**: `.design-sync/**`, `.gitignore`, `app/(workspace)/presence-provider.tsx` (export `PresenceContext` for previews only).
- **Reuse**: the app's own Tailwind v4 PostCSS plugin (`.design-sync/build-css.mjs`) and `@theme` tokens in `app/globals.css`.
- **Done**: every preview graded good, `package-validate.mjs` exits 0, project file count matches `ds-bundle/`.

## Acceptance

- [x] 19 components in the project, each with an authored preview
- [x] `.design-sync/conventions.md` validated against the build
- [x] `pnpm lint && pnpm test` pass

## Cross-cutting

Stacked on `feat/floating-view` (PR #122): FloatingFrame and floating-views exist only there. Rebase onto `upstream/main` after #122 merges.

## Review

