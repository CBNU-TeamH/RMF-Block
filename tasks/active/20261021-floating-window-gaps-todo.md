# Floating window gaps: bring to front, Escape, a cap on open views, and opening top-left

**Created**: 2026-10-21
**Issue**: #144 (absorbs #116; keyboard move and resize split off to #231), #224
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

### 4. A new view opens at the top left (#224)

- **What**: a new floating view opens 24px inside the main area's top-left, right of the sidebar whether it is open or collapsed, and the next steps down-right. Fitting keeps the top-left, so the corner grip has room to grow at once. A window restored from `localStorage` stays where it was saved. The maintainer chose this placement after hearing what it costs on a laptop-width screen: the window covers the editor's left margin.
- **Files**: `lib/floating/views.ts`, `app/(workspace)/floating-views.tsx`, `app/(workspace)/ui.tsx` (`MAIN_ID`), `app/(workspace)/layout.tsx`.
- **Reuse**: `openView`'s free-slot search, which now matches a slot by its corner instead of its right edge.
- **Done**: the first view opens at the main area's corner plus 24px, and a second 24px down-right of it.

## Test selection

- Vitest (logic / component / server / route):
  - `lib/floating/views.test.mts`:
    - `openView` refuses past `MAX_VIEWS` but not a duplicate, and `parseViews` keeps the first five;
    - a view opens inside `origin` and cascades down-right, and fitting keeps the top-left (#224).
  - New `app/(workspace)/floating-frame.test.tsx`, which tests the stack through the frame both windows render:
    - a window that opens is in front, and a press raises one and focuses it;
    - a focus raises one;
    - a closed window leaves no gap, and the front stays under `z-40`;
    - Escape closes the window it is in, but not during a composition, from inside a dialog, or once something inside used it.
  - New `app/(workspace)/floating-views.test.tsx`: a sixth view is refused with the notice; an open one again says nothing; a view opens just inside the main area's top-left.
  - `chat-panel.test.tsx`: Escape with a draft or a file stays in the panel; Escape closes the document picker first.
- Browser E2E (`e2e/`): new `e2e/floating-windows.e2e.ts`. The first view opens 24px inside the main area; a sixth is refused with the notice; a click on the backmost raises it above the chat window, and Escape closes only it. The rows it floats sit below filler lines, since at Playwright's 1280px the views cover the top of the editor.
- Container smoke (`.github/workflows/ci.yml`): no change — startup, auth and networking are untouched.
- Commands and observed results (fill in before the PR):
  - `pnpm typecheck`, `pnpm lint`: clean. `pnpm test`: 82 files, 886 tests passed. `pnpm build`: passed (also after the `/simplify` cleanups). `pnpm comments`, `pnpm verify:docs`: clean.
  - Each guard in `FloatingFrame` was removed in turn; each removal failed a test. The guards are the composition, the dialog, `defaultPrevented`, the focus on a press, the focus raise and the window blur.
  - `e2e/floating-windows.e2e.ts`: type-checked and collected (1 test); not run here, since this machine has no Playwright browsers.
  - In Chrome on the isolated stack, as the host, with a text, an image, a PDF and two more image views. Every press and key was real unless noted:
    - The five opened at z 34–38. A sixth (opened by a script) was refused, and the notice showed at the bottom centre.
    - After a reload the five came back in their saved order.
    - A press inside the PDF viewer raised it (36 → 38). That press first did not raise it at all; see "Fixed on the way".
    - A press on the backmost window's title bar raised it to the front and focused it. Escape then closed only that one, and the order closed up to 34–37.
    - The chat window opened in front of the views (38). A press on a view's title bar then put that view above the chat.
    - In the chat input, Escape with a draft kept the window and the draft; with the input cleared, Escape closed it.
    - With the document picker open, the first Escape closed only the picker, and the second closed the window.
    - With the chat file list's preview open, the first Escape closed only the dialog, which handed focus back inside the chat. The second closed the chat.
    - Two Escapes in the editor, around a typed `/`, closed no window.
  - The top-left placement (#224), on a rebuilt stack with the main area at (260, 90):
    - A new image view opened at (284, 114).
    - A real drag on its corner, straight after opening, grew it from 384×260 to 679×432 with its top-left still, and the size was saved.
    - With the sidebar collapsed (main area at 48), the next view opened at (72, 114).
    - A view saved at the old top-right spot (1919, 56) came back there after a reload, as did the other two.
    - With (284, 114) taken, the next view opened at (308, 138).
  - Not checked in the browser: Escape during a real IME composition (the unit test fires one).
  - Fixed on the way: a press inside a PDF raised nothing. Chrome gives the page no focus event for it, so the frame now also raises on the window's `blur` when the iframe it holds is active.

## Acceptance

- [ ] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] A click or focus in the chat window or any floating view brings it to the front, also inside a PDF.
- [ ] Escape closes the focused window, and only it. A composition, a dialog, a draft and the editor's own Escape are left alone.
- [ ] A sixth floating view is refused with the notice.
- [ ] A new floating view opens at the main area's top-left and cascades down-right; a restored one stays where it was saved.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm verify:docs`, `pnpm comments` pass.

## Cross-cutting

FR-070-02 and FR-070-06 (several views pinned above the work), and WBS 11.1. `floating-view.md` loses "bring-to-front" and "cap" from "Not built", and `chat.md`'s floating window gets Escape. The SRS is unchanged. #116 closes with this. #231 takes the keyboard. #224 closes with this too.

## Review

Branch: `feat/floating-window-gaps`.

Shipped milestones 1–3, with the maintainer's choices:
- a cap of five, refused with a notice;
- Escape closes only the window focus is in;
- keyboard move and resize split off to #231.

The browser check caught one gap: a press inside a PDF raised nothing until the frame also listened for the window's blur.

A `/simplify` pass (four sub-agents) applied three cleanups:
- the z-index base is worked out from `MAX_VIEWS`, so a larger cap cannot push windows over the menus;
- `openView` no longer runs the duplicate check twice;
- `drop` keeps the order as is for a key already gone.

Declined, with reasons in the PR:
- one Escape rule without the `<dialog>` exception: a native dialog closes on the key's default action, so it cannot `preventDefault` and still close;
- one handler for the chat panel's two Escapes: they are independent;
- a shared transient-notice hook: the other three copies are outside this diff, and none has the same shape;
- `openView` returning an outcome instead of the provider's ref: telling a refusal from inside the state updater would be a side effect there.

A `/code-review low` pass (one sub-agent) raised nothing.
