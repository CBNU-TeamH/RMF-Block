# Say 미리보기 불가 where a file cannot be previewed

**Created**: 2026-11-22
**Issue**: #280
**Design**: [`docs/design/file-manager.md`](../../../../docs/design/file-manager.md) ("Per row", "Previewing a file") and [`docs/design/chat.md`](../../../../docs/design/chat.md) (the chat file list) own the surfaces. This task adds a sentence to each, so no new design doc.

## What this is

FR-080-05, from UC-080's alternative flow E3: for a format that cannot be previewed, the system shows "미리보기 불가" and offers a download. Today the download is there, but nothing says the preview is unavailable. 미리보기 is simply left out when `isInlineType` (`lib/files/serving.ts`) is false. The D07 test report judges FR-080-05 partial because of it.

Where a file without a preview is offered today:

| Surface | File | What it shows now |
|---|---|---|
| File manager row | `app/(workspace)/files/file-manager.tsx:156` | no 미리보기 button; 원본 위치, 내려받기 |
| Chat file list | `app/(workspace)/chat-files.tsx:88` | no 미리보기 button; 내려받기 |
| Chat message attachment | `app/(workspace)/chat-message.tsx:61-69` | a card: name, `size · 내려받기` |
| File block in a document | `app/(workspace)/documents/[id]/file-block.tsx:37-47` | a card: name, `size · 내려받기` |

## Plan and trade-offs

**Recommended: a quiet 미리보기 불가 label where the button would be.**

- In the two lists, the rows that get no 미리보기 button show a plain, muted `미리보기 불가` in its place. It is text, not a button, so it adds no dead click and no focus stop.
- On the two cards, the subtitle becomes `size · 미리보기 불가 · 내려받기`. A file block is always a type without a viewer, because images and PDFs get their own blocks (`docs/design/document-editing.md`, "Mapping").
- One shared constant holds the wording, the way the files UI already shares `ACTION`.

**Not chosen: keep 미리보기 on every row and open the dialog with the notice for an unsupported file.** That follows E3 step by step (click, check, notice, download), but it costs a click that can never show anything. It also makes the preview dialog handle a second case. The requirement asks for the notice and the download, which the label gives without the extra round trip.

Word, PowerPoint and Excel previews (UC-080's "Notes") stay out of scope. `file-manager.md` lists them under "Not built".

## Milestones

### 1. The label in the two lists and on the two cards

- **What**: every place that offers a file without a preview says 미리보기 불가 next to the download.
- **Files**: `app/(workspace)/files/file-manager.tsx`, `app/(workspace)/chat-files.tsx`, `app/(workspace)/chat-message.tsx`, `app/(workspace)/documents/[id]/file-block.tsx`, and the shared wording (`app/(workspace)/ui.tsx` or next to `isInlineType`'s callers).
- **Reuse**: `isInlineType` decides it, as it already does for the button. No new rule.
- **Done**: component tests show the label for an unsupported type and none for an image or PDF. The E2E `viewer` spec sees it in the chat list and the file manager.

### 2. Docs and the test report

- **What**: `file-manager.md` ("Per row") and `chat.md` (the chat file list) say what a file without a preview shows. STC-080-003's expected result in D07 adds the notice. The D07 draft is untracked and is updated outside this PR.
- **Done**: `pnpm verify:docs` is clean.

## Test selection

- Vitest (logic / component / server / route): `chat-files.test.tsx` and the file manager's component test get a case each: the label for an unsupported type, none for an allowed one. `file-block` and `chat-message` get the same if they have component tests; if they do not, the E2E check covers them.
- Browser E2E (`e2e/`): `e2e/viewer.e2e.ts`. The STC-050-005/080-003 test already asserts that no 미리보기 button is shown. It will also assert 미리보기 불가 in the chat list and the file manager.
- Container smoke (`.github/workflows/ci.yml`): no change. No route or server behaviour changes.
- Commands and observed results:
  - `pnpm exec vitest run` on `chat-files`, `chat-message`, `file-manager`, `file-block` tests: 13 passed. Each of the four new assertions fails with the wording emptied (checked by setting `PREVIEW_UNAVAILABLE` to `""`, then reverted).
  - `pnpm e2e` `e2e/viewer.e2e.ts` on an isolated stack built from this branch (Chromium): 4 passed. The first run failed on the new assertion because the chat's message card and the list row both matched; the spec now scopes the list row (`li:not([data-message-id])`) and asserts the message card separately.
  - `pnpm lint`, `pnpm typecheck`, `pnpm verify:docs`, `pnpm comments`: see the PR's checks.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [x] Each surface in the table above shows 미리보기 불가 for a file without a preview, and only for those.
- [x] Each new assertion fails when the label is removed (a mutation check, recorded).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm verify:docs` pass.

## Cross-cutting

- Requirement: FR-080-05 (UC-080, E3). The D07 test report's STC-080-003 and its UC-080 implementation coverage, which goes from 0.80 to 1.00 once this merges.
- It ships in the release that the two-device NFR-PER re-measurement runs against.

## Review

- **Shipped** (#283, squash 17f8fd7): a muted `미리보기 불가` where the 미리보기 button would be, in the file manager row and the chat's file list; `size · 미리보기 불가 · 내려받기` on the chat message card and the document's file block. One constant, `PREVIEW_UNAVAILABLE`. Four component tests (two new files) and three E2E assertions in `viewer`, each failing with the wording emptied. The two design docs say what such a file shows.
- **Cut:** a shared `PreviewUnavailable` component for the two list spans, which differ in classes, and a shared builder for two test files. Both came up in `/simplify` as optional.
- **Moved on:** D07's STC-080-003, FR-080-05 and UC-080 were updated outside the repository after the merge.
