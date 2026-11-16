# Import a Markdown file as a new document

**Created**: 2026-11-16
**Issue**: none — requested directly (Markdown import, "새 문서로")
**Design**: [app-shell.md, "Importing Markdown"](../../../../docs/design/app-shell.md#importing-markdown)

## Milestones

### 1. Pick a file in the 새 문서 dialog, fill the new document with it

- **What**: the dialog takes an optional `.md` file (its name fills an empty name field); after 만들기 the new document is seeded with the file's blocks instead of one empty block — read the way a multi-line paste is, without the blank lines between paragraphs.
- **Files**: `app/(workspace)/new-document.tsx`, `app/(workspace)/pending-import.ts`, `app/(workspace)/documents/[id]/use-block-document.ts` (the seed), `lib/blocks/paste.ts` (`pastedBlock`, moved out of the editor), `lib/blocks/markdown-import.ts` (+ test), `editor.tsx` (uses `pastedBlock`), `docs/design/app-shell.md`, `e2e/markdown-import.e2e.ts`.
- **Reuse**: `POST /api/documents` and the dialog's validation; `parsePaste`; the two-step fill `replaceBlocks` uses (empty CRDT nodes first, then their strings). Structure added by #264 applies once both are in.
- **Done**: the E2E picks a file, creates the document and reads its blocks.

## Test selection

- Vitest (logic / component / server / route): new `lib/blocks/markdown-import.test.mts` (blank lines dropped, empty-text blocks kept, blank file → nothing, distinct ids). The seed itself has no unit test (the hook has none); the E2E covers it.
- Browser E2E (`e2e/`): new `e2e/markdown-import.e2e.ts` — dialog → file → 만들기 → blocks, and an undo straight after leaves the import; `tree.e2e.ts` re-run for the dialog's create path.
- Container smoke (`.github/workflows/ci.yml`): no change — runs the E2E layer.
- Commands and observed results: `pnpm test` 911 passed; `pnpm lint`, `pnpm typecheck`, `pnpm verify:docs`, `pnpm comments` clean; `markdown-import.e2e.ts` 3/3 (`--repeat-each=3`). Full `pnpm e2e:isolated`: 37 passed, 2 failed — `tabs.e2e.ts:4` (fails locally on `main` too, passes in CI) and `collaboration.e2e.ts:107` (eight users), which failed 1 of 3 on a rerun here and 1 of 3 on `main` (`9c86694`) the same way.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] Creating a document without a file behaves as before (the seed is still one empty text block).
- [x] Nothing new is uploaded or stored: the file is read in the browser and the import is the document's seed.

## Cross-cutting

UC-021 (document creation) gains an optional input; no SRS, API or storage change.

## Review

- `/code-review low`: no findings.
- `/simplify`: applied — the import moved from an editor effect (which guessed "new document" from React state and was undoable) into the seed in `use-block-document.ts`, so the `pasteLines` split and the effect are gone and the import sits below the undo floor; `blockFor` moved to `paste.ts` as `pastedBlock`; the dialog holds the picked `File` and reads it in `create()` (no race with an early 만들기); the hidden input is wrapped in its label, as the editor footer's picker is; comments cut to citations. Skipped: folding `markdown-import.ts` into `paste.ts` (#264 rewrites `paste.ts`; a separate file keeps that merge small).

