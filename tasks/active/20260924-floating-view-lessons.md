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
- **An `<iframe>` under the pointer swallows `pointermove`.** Dragging a window that holds a PDF
  would stall once the cursor crossed it. `setPointerCapture` on the gesture's start fixes that
  for both windows.
- **`tsc --noEmit` is already red on `main`**: `app/(workspace)/page.test.tsx:20` builds a
  `StoredMember` without `lastJoinedAt`. Vitest does not typecheck, so no CI job catches it.
  Left alone here, since it is out of scope.

## What we would do differently

- ...

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Any new holder of a content document goes through `lib/documents/attach-pool.ts`, never
  `client.attach` directly. This is already stated in `document-editing.md`; promote it to
  `docs/conventions.md` if a third holder appears.
