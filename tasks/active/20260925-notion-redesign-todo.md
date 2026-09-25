# Redesign the app: "B · Soft / paper" (light)

**Created**: 2026-09-25
**Issue**: none yet. Follow-ups are filed as two issues at the end (see Review).
**Design**: [`docs/ui/redesign/HANDOFF.md`](../../docs/ui/redesign/HANDOFF.md) is the spec; [`source.md`](../../docs/ui/redesign/source.md) records the decisions.

Stacked on `chore/design-sync`, which is stacked on PR #122.

## Milestones

### 1. Font and tokens

- **What**: Pretendard is bundled with the app; the HANDOFF §2 tokens are in `@theme`; hard-coded colours become tokens.
- **Files**: `app/fonts/`, `app/layout.tsx`, `app/globals.css`, `.design-sync/build-css.mjs`.
- **Reuse**: the existing `@theme` names (`ink*`, `paper*`, `shell`, `sky*`) keep their values.
- **Done**: `pnpm build` passes, and every page renders in Pretendard with no network access.

### 2. Shell layout

- **What**: the document list moves from the home page into a sidebar tree on every page, and the header shows a breadcrumb.
- **Files**: `app/(workspace)/layout.tsx`, `page.tsx`, `document-list.tsx`, a new breadcrumb component.
- **Reuse**: `treeRows` in `lib/documents/tree.ts` and the existing socket updates in `DocumentList`.
- **Done**: the home and document pages both show the tree, and the current document is highlighted.

### 3. Component restyle

- **What**: HANDOFF §3, per component, with behaviour unchanged.
- **Files**: every component under `app/(workspace)/` and `app/join/`.
- **Reuse**: existing roles and labels, so the tests keep querying them.
- **Done**: container screenshots match the spec.

### 4. Re-sync Claude Design

- **What**: `/design-sync` re-run so the design system shows the new look.
- **Files**: `.design-sync/**`.
- **Done**: the changed previews are graded good and uploaded.

## Acceptance

- [x] `pnpm lint && pnpm test && pnpm build` pass
- [x] The container shows the redesign on the join, home and document pages, and in the chat window, row menu and dialog
- [ ] The design system project is updated
- [ ] Two follow-up issues are filed (in-screen / server-protocol)

## Cross-cutting

- This supersedes `docs/ui/dashboard/` as the visual reference, so the reviewer signs off on that.
- No SRS requirement changes.

## Review

Shipped: milestones 1–3 (tokens and a bundled Pretendard, the sidebar tree and breadcrumb, a per-component restyle), plus the design-sync inputs updated for the new look. `/code-review low` found nothing. `/simplify` moved the dialog chrome into `app/(workspace)/ui.tsx`, added a `scrim` token, made the catalogue read happen once per request, and stopped the 2MB font preload.

Not done in this PR:
- **Claude Design upload.** The re-sync is built and graded locally, but the upload approval was declined; run `/design-sync` again to push it.
- **Dark mode.** Deferred by decision: tokens are in place, the values are not.
- **HANDOFF behaviours.** Split into two follow-up issues (in-screen / server-protocol).
- **Container re-check.** The last `/simplify` pass was checked by lint, tests and build, not a container run.

Removed on purpose: the home page's document table and its creator/date columns. The sidebar tree replaces them, and the SRS asks for a document tree, not those columns.

