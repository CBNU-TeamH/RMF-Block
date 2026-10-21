# Floating window gaps: bring to front, Escape, and a cap on open views

**Created**: 2026-10-21
**Issue**: #144 (absorbs #116; keyboard move and resize split off to #231)
**Design**: [Floating view](../../docs/design/floating-view.md)

## Milestones

### 1. The window you use is in front

- **What**: the chat window and the floating views share one stacking order. Pressing in a window, or focusing into it, raises it, and a window that opens comes up in front. The order stays below the shell's menus (`z-40`).
- **Files**: new `app/(workspace)/window-stack.tsx`, `app/(workspace)/floating-frame.tsx`, `app/(workspace)/floating-views.tsx`, `app/(workspace)/chat-window.tsx`, `app/(workspace)/layout.tsx`.
- **Reuse**: `FloatingFrame`, which both windows already render. The raise lives there, so neither caller repeats it.
- **Done**: with two windows overlapping, a click on the one behind brings it in front. A PDF window comes to the front even when the click lands inside its viewer.

### 2. Escape closes the window you are working in

- **What**: Escape closes the focused window. It does nothing during an IME composition, inside a `<dialog>` the window opened, or in the chat input while it holds text or a file. The chat's document picker closes on Escape before the window does. A floating view takes focus when clicked, so Escape reaches it.
- **Files**: `app/(workspace)/floating-frame.tsx`, `app/(workspace)/chat-panel.tsx`.
- **Reuse**:
  - the IME guard the chat input's Enter already has (`isComposing`);
  - version history's reason for not closing two layers on one key.
- **Done**: Escape closes a clicked floating view and the chat window. A draft survives an Escape, and the editor's own Escape (the `/` menu) closes nothing else.

### 3. At most five floating views

- **What**: a sixth floating view is refused, and "플로팅 뷰는 최대 5개까지 열 수 있습니다." shows for a moment. A saved list longer than five keeps its first five.
- **Files**: `lib/floating/views.ts`, `app/(workspace)/floating-views.tsx`.
- **Reuse**: `openView`, which already refuses a duplicate; and the dark pill of `block-menu.tsx`'s 복사됨.
- **Done**: the sixth open leaves five windows and shows the notice. Opening one that is already open still does nothing, without the notice.

## Test selection

- Vitest (logic / component / server / route):
  - `lib/floating/views.test.mts`: `openView` refuses past `MAX_VIEWS` but not a duplicate; `parseViews` keeps the first five.
  - New `app/(workspace)/floating-frame.test.tsx`, which tests the stack through the frame both windows render:
    - a window that opens is in front, and a press raises one and focuses it;
    - a focus raises one;
    - a closed window leaves no gap, and the front stays under `z-40`;
    - Escape closes the window it is in, but not during a composition, from inside a dialog, or once something inside used it.
  - New `app/(workspace)/floating-views.test.tsx`: a sixth view is refused with the notice; an open one again says nothing.
  - `chat-panel.test.tsx`: Escape with a draft or a file stays in the panel; Escape closes the document picker first.
- Browser E2E (`e2e/`): new `e2e/floating-windows.e2e.ts`. Two floating views overlap; a click on the one behind raises it, Escape closes it, and a sixth view is refused with the notice.
- Container smoke (`.github/workflows/ci.yml`): no change — startup, auth and networking are untouched.
- Commands and observed results (fill in before the PR):

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] A click or focus in the chat window or any floating view brings it to the front, also inside a PDF.
- [ ] Escape closes the focused window, and only it. A composition, a dialog, a draft and the editor's own Escape are left alone.
- [ ] A sixth floating view is refused with the notice.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm verify:docs`, `pnpm comments` pass.

## Cross-cutting

FR-070-02 and FR-070-06 (several views pinned above the work), and WBS 11.1. `floating-view.md` loses "bring-to-front" and "cap" from "Not built", and `chat.md`'s floating window gets Escape. The SRS is unchanged. #116 closes with this. #231 takes the keyboard. #224 (where a new window opens) is not part of this.

## Review

Filled in at the end.
