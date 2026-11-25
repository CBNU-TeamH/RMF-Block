# Demo hotfixes: chat reconnect, unsent-edit warning, occupant avatar, dismissed / menu

**Created**: 2026-11-23
**Issue**: #241, #221, #80, #148 — bundled as one task ahead of recording the demo video
**Design**: [chat.md](../../../../docs/design/chat.md), [document-editing.md](../../../../docs/design/document-editing.md), [presence-and-focus.md](../../../../docs/design/presence-and-focus.md)

## Milestones

One commit per issue. All four are client-only; no server, protocol or REST change.

### 1. Chat reconnects as soon as the network returns (#241)

- **What**: on `online`, or `visibilitychange` to visible, a closed chat socket reconnects at once instead of waiting out its backoff (up to 15 s). The backoff stays for the server-restart case it was written for.
- **Files**: `app/(workspace)/chat-panel.tsx` (+ `chat-panel.test.tsx`), `docs/design/chat.md`.
- **Reuse**: the effect's own `connect`, `retry` and `attempt`; the `open` handler already backfills.
- **Done**: a test closes the socket, fires `online`, and sees a new socket before any backoff timer runs.

### 2. Warn before leaving with edits Yorkie has not received (#221)

- **What**: while a block document holds local changes not yet pushed, `beforeunload` asks the browser to confirm. A flush cannot be guaranteed during unload, so a warning is the fix the issue settles for.
- **Files**: `lib/documents/attach-pool.ts` (+ test), `docs/design/document-editing.md`.
- **Reuse**: the pool's attach/detach in `poolFor`, which every holder (editor and floating views) goes through; Yorkie's `doc.hasLocalChanges()`.
- **Done**: a test sees `beforeunload` prevented with local changes, not prevented without, and no listener left after detach.

### 3. Occupant avatar on the block's right edge (#80)

- **What**: the avatar of whoever occupies a block moves from under the drag handle (`top-8 -left-[24px]`, where it can sit over the next block's controls) to the block's right edge at first-line height, Notion style.
- **Files**: `app/(workspace)/documents/[id]/editor.tsx`, `docs/design/presence-and-focus.md`.
- **Reuse**: the row's existing `relative` box and the `px-16` column gutter.
- **Done**: in two browsers, the avatar shows right of the occupied block and never overlaps the ···, floating-view or drag controls.

### 4. A dismissed `/` menu stays closed while its query continues (#148)

- **What**: Escape remembers the query it dismissed; while the text still extends that query the menu stays shut. Deleting the `/`, a space or newline (no query), blur, or choosing an item clears it.
- **Files**: `app/(workspace)/documents/[id]/text-block.tsx` (+ `text-block.test.tsx`), `docs/design/document-editing.md` (the "recomputed from the text rather than tracked as a session" sentence).
- **Reuse**: `syncSlashQuery`, `detectSlashQuery` (`lib/blocks/slash-menu.ts`), the existing Escape and blur handlers.
- **Done**: tests — typing on after Escape shows no menu; deleting and retyping `/` reopens it; blur and refocus reopens it.

## Test selection

- Vitest (logic / component / server / route): `chat-panel.test.tsx` (online reconnect), `attach-pool.test.mts` or a sibling (unload warning), `text-block.test.tsx` (dismissed query, three cases). #80 is a position class — checked by eye in the container, not pinned by a unit test.
- Browser E2E (`e2e/`): no new specs and no local run (user's call for a pre-demo hotfix). The CI E2E step is `continue-on-error`; its result is read, not waited on. Specs that `reload()` right after an edit could meet the new prompt only in the brief window with unsent changes.
- Container smoke (`.github/workflows/ci.yml`): no change — nothing touches startup, auth or networking on the server.
- Commands and observed results:
  - `pnpm exec vitest run` on `chat-panel.test.tsx`, `text-block.test.tsx` and `attach-pool.test.mts`: 3 files, 42 tests passed (2026-11-24, after the CodeRabbit fixes in `791e364`).
  - `pnpm verify:docs`: clean.
  - CodeRabbit on #287: two fixed in `791e364` (the unload warning now outlasts the detach in flight; a peer's edit expires a stale `/` dismissal), each with a test that fails without the change. Filed, not fixed: #288 (presence-only pending changes still prompt) and #289 (a queued remote edit during an IME composition leaves a stale dismissal). One withdrawn by CodeRabbit (a pasted `/t` over a selected `/`).
  - `/simplify`: one change (`syncSlashQuery`'s reset folded into one condition, `2bdb689`). `/code-review low`: no findings (a shallow pass — 3 tool calls).
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`: not run locally; the pre-push hook and CI cover them.
  - No browser run for #241, #221 and #80: the offline/online toggle, Ctrl+R and the avatar position below were not checked by eye in this task.

## Acceptance

- [x] Required test changes are included with the implementation; relevant checks and any gaps are recorded.
- [ ] After a 20 s offline/online toggle in DevTools, chat reconnects within about a second and backfills.
- [ ] Ctrl+R right after typing prompts; after the edit has synced it does not.
- [ ] The occupant avatar sits right of the block and clears the gutter controls.
- [ ] `/usr` → Escape → `/usr/b` keeps the menu closed; retyping `/` reopens it.

## Cross-cutting

NFR-REL-001 (resync after recovery) for #241; UC-022 editing for #221 and #148; presence display for #80. No SRS, storage or API change.

## Review

All four shipped as one commit each, plus one `refactor:` commit from `/simplify`. Each logic fix has a unit test (#241 online reconnect, #221 unload warning, #148 two cases); #80 is a position class with no test.

Not done: the three browser acceptance checks (#241, #221, #80). Nothing was cut and nothing moved to another task. A spec that `reload()`s right after an edit could meet the new #221 prompt in the brief window with unsent changes; CI's E2E step will show whether any does.
