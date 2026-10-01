# Floating view of a block (UC-070) — lessons

**Created**: 2026-09-24

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **Yorkie refuses a second attach of the same key from one client** (`"<key> is already
  attached"`). Any second view of a document has to share the attachment. The refcounted pool
  that does this also made `use-block-document.ts`'s Strict Mode teardown chain unnecessary: the
  second run's acquire lands before the first run's release, so the count goes 1→2→1 and
  nothing re-attaches.
- **An `<iframe>` under the pointer swallows `pointermove`, and pointer capture does not help
  with a PDF.** Chrome's PDF viewer runs out of process. A drag or resize that crossed one
  stalled, the chat window's included, even with `setPointerCapture`. The unit tests could not
  show this; only the Playwright check did. The fix is `pointer-events: none` on every iframe
  while a gesture runs.
- **Sharing one document object changes what identity checks mean.** `docRef.current === held`
  used to mean "this run's document". Once the pool hands every run the same object, it also
  means the next run's, and a late cleanup wiped it: every edit was dropped under Strict Mode.
  Likewise detaching no longer clears presence while a floating view still holds the document.
  So the editor must clear `activeBlockId` itself, or peers see a ghost occupant for 30 s.
- **Playwright's `hover()` and `click()` scroll the target into view first, and that hid a
  real bug.** The 🪟 button sat at `-right-6`, outside the editor's `overflow-y-auto` container,
  so its sideways overflow scrolled out of sight: a person could not see or reach it. The
  first browser check still passed, because Playwright scrolled it into view. The user caught
  it by hand. The check now moves the real pointer to the row and asserts the button is inside
  the container and is what `elementFromPoint` returns. It fails on the old build and passes on
  the fix (`-mr-6 pr-6`, mirroring the drag handle's `-ml-4 pl-4`).
- **`client not activated` during a reload is noise.** The Yorkie SDK deactivates its client on
  `beforeunload`, so attach requests still in flight from the page being reloaded fail and log.
  The editor's own attach logs it too. Floating views only add more requests in flight.
- **The dev server on `/mnt/c` missed a file change.** A fix looked like it did nothing until the
  server was restarted. Restart `pnpm dev` before trusting a dev-mode rerun on WSL. `pnpm dev`
  also rewrote `tsconfig.json`'s `include`; that change was reverted, not committed.
- **`tsc --noEmit` is already red on `main`**: `app/(workspace)/page.test.tsx:20` builds a
  `StoredMember` without `lastJoinedAt`. Vitest does not typecheck, so no CI job catches it.
  Left alone here, since it is out of scope.

- **"Follow whichever axis asks for more" only works for growing.** A corner drag inward along
  one axis never shrank the window, because the untouched axis still asked for the full size.
  The rule that works both ways is the axis that moved further in proportion. The unit tests
  had only tried growth; the browser check tried shrinking.
- **Anything keyed on a window's `x` breaks once windows are fitted.** Fitting keeps the right
  edge, so the cascade's "slot taken?" check has to compare right edges.

## What we would do differently

- Run a real browser against the feature before `/simplify` and `/code-review`, not after. Four
  of the five bugs the browser check found were behaviours no reviewer or unit test had a way
  to see.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Any new holder of a content document goes through `lib/documents/attach-pool.ts`, never
  `client.attach` directly. This is already stated in `document-editing.md`; promote it to
  `docs/conventions.md` if a third holder appears.
- A two-user Playwright check was cheap here: Playwright was already in the npx cache and one
  missing library could be extracted without root. It found real bugs. Worth deciding whether
  such a check belongs in the repo.
