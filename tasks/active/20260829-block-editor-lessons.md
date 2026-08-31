# Open a document and edit it together — lessons

**Created**: 2026-08-29

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **`yorkie.Tree` has no move operation at all, and `yorkie.Array` has five.** Counted in the
  0.7.14 source: `document/json/array.ts` exposes `moveBefore`, `moveAfter`, `moveAfterByIndex`,
  `moveFront` and `moveLast`; `document/json/tree.ts` exposes none. That, not any limitation of
  rich-text frameworks, is why ProseMirror is out — its Yorkie binding is Tree-shaped, and
  FR-022-04 would become delete-then-recreate, which `document-editing.md`'s Verification item 4
  measured as silently losing the text.

- **A controlled `<textarea>` broke worse than expected, and the worse half was our own bug, not
  React's.** Step 0's spike (`app/(workspace)/spike/ime-harness/`) diffed local keystrokes against
  a `lastSyncedRef` baseline that the remote-edit path forgot to update. Two clients typing
  "안녕하세요" into the same empty block concurrently produced `"안안녕녕하세요"` — the whole
  string reinserted on top of itself, repeatedly. **Any surface reading "current text" from one
  source while diffing against a second, independently-updated baseline has to advance both on
  every path that touches either** — the remote path mutates "what Yorkie holds" exactly as much
  as the local path does. Fixed by updating the baseline in the remote handler too; see
  `document-editing.md`'s "Editing surface" §"What was measured" for the rest of what Step 0 found
  (an uncontrolled textarea patched by range, with composition guarded and flushed on
  `compositionend`, held up under the same test).

- **React Strict Mode's double-invoke-on-mount raced two `client.attach()` calls for one document,
  and the failure it produced named the wrong culprit.** Dev-mode Strict Mode runs an effect
  mount → cleanup → mount, synchronously, on first mount. `DocumentEditor`'s effect attached the
  same document key from the same client twice; the cancelled run's `attach()` succeeded anyway,
  and nothing detached it — `docRef.current` was only ever assigned past the post-attach
  `cancelled` check, so the cleanup's `if (docRef.current) client.detach(...)` had nothing to see.
  The surviving run's own `attach()` then failed Yorkie's Mongo-side `TryAttaching` compound filter
  (client activated **and** document not already `Attached`) and surfaced as **"client not
  found"** — a message about the client, for a problem that was actually the document. Same class
  of bug `presence-provider.tsx`'s `#32` comment already names and fixed once, for
  `client.activate()`; this was one layer deeper. Fixed by serializing: a ref holds the previous
  run's full teardown promise, and each run's `attach()` awaits it before firing, so an attach
  never reaches the server while a prior run's document is still marked `Attached`.

- **A script that talks to a real Yorkie server is not a browser.** M2's "verification" was
  standalone Node scripts driving real `yorkie.Client`s — it proved the CRDT/data-layer path
  converges, and it caught nothing about the bug above, because there is no React effect lifecycle
  outside a browser to race in the first place. The user's first real-browser open found it
  immediately. **A script-based check answers "does the data layer work," not "does the
  component work" — the second question needs an actual browser at least once before a UI
  milestone is called done.**

- **A `changeBlockType` conversion is invisible to a peer's `doc.subscribe()` unless the callback
  watches for `set`, not just `edit` and `add`/`remove`/`move`.** Assigning a plain field
  (`block.type = "heading"`, `content.level = 2`) is a `SetOpInfo` (`{ type: 'set'; path; key }`),
  a fourth op shape distinct from all three the subscribe callback already handled. Missing it
  meant a peer's heading conversion showed the text clearing (that part is an `edit`) but never
  updated the block's rendered type — until some unrelated later op (e.g. Enter's `insertBlockAfter`)
  happened to trigger a recompute for an entirely different reason, which is what made it look
  like "renders correctly, just late" rather than "half the change never arrives." Fixed by
  widening the condition to any op whose `path` is `"$.blocks"` or starts with `"$.blocks."` —
  simpler than enumerating every op type `changeBlockType` can produce, and correct because the
  `edit` branch above it already `continue`s past the one path shape that should *not* trigger a
  full recompute.

- **Concurrent merge duplicates text; concurrent split duplicates blocks — both converge, neither
  is a bug.** Measured against a live server: two clients merging the same block concurrently
  produced `"paragraphgraph"`, not `"paragraph"` — the block removal is idempotent (Yorkie
  tombstones), but each side's text-append is an independent CRDT insert, and both survive. Same
  shape as the earlier "안녕하세요" → "안안녕녕하세요" finding, at the block-structure level
  instead of the character level. Worth remembering before "fixing" a future case like this:
  correctness here means *converges without loss*, not *deduplicates human intent* — no pure CRDT
  operation can tell that two people meant the same edit.

- **A focus-handoff mechanism built for one case (a block that doesn't exist yet) doesn't
  automatically fit a different case (a block that already exists).** `pendingFocusRef` +
  `useEffect(..., [blocks])` only works because split/merge always call `setBlocks` right after
  `focusBlock` — the effect needs a render to re-run, and that render is a side effect of the
  block-list change, not something the mechanism itself causes. Arrow-key navigation never touches
  the block list, so routing it through the same ref+effect would silently strand the request until
  some unrelated later edit happened to fire the effect for a different reason — a bug that would
  only show up as "arrow key sometimes doesn't focus," easy to blame on something else. Caught before
  writing any code, during a Plan-agent validation pass that re-read the effect's own comment
  ("refs attach during commit, strictly before effects... nothing async is actually being waited
  for") and noticed navigation doesn't share the one thing the mechanism actually depends on.
  Fixed by reading `elementsRef` directly and calling `.focus()` synchronously — the target block
  is always already mounted for navigation, so the effect's whole reason to exist (wait for a
  brand-new block to render) never applied here.

- **Caret math that works for a single-line block silently breaks for a multi-line one, and
  multi-line is real the moment Shift+Enter exists.** The first draft of ↑/↓ navigation clamped the
  landing caret against the *whole* target block's text length. That's only correct when the target
  has no `\n` in it — for a multi-line block, ArrowUp needs the caret on the target's *last* line
  and ArrowDown on its *first*, each clamped against that one line's length, not the block's total.
  Nothing about single-line testing would have caught this; it only shows up once someone
  Shift+Enters inside a block and then arrows into it from a neighbor.

- **A dev-server edit not showing up in the browser had two different, unrelated causes back to
  back — worth separating them, since only one was ever a real code bug.** First: the SVG drag
  handle's markup was entirely absent from the DOM (not just miscolored) — the running dev server's
  `.next` was stale from an earlier `pnpm build` run alongside `pnpm dev` (a corruption this project
  had already hit and fixed once before, milestone 2). Full restart + `.next` wipe fixed it. Second,
  right after: the drop-indicator *line* was still invisible even post-restart. Measured properly
  this time instead of guessing "must be cache again" — grepped the actual compiled CSS chunk and
  found `border-t-2`/`border-b-2` present but bare `border-sky` completely absent, in every rebuild,
  cache or no cache. Working directory is `/mnt/c/Users/user/Desktop/rmf-block` (WSL2 mounting a
  Windows filesystem, DrvFs) — a real, known source of unreliable file-change detection for dev
  watchers, which explains the first case, but the second was a genuine Tailwind gap: `bg-sky` and
  `border-sky-deep` are this codebase's actual precedent (used in `document-list.tsx`/
  `join-form.tsx`) and compile fine; a bare `border-sky` never has, anywhere, checked. Fixed by
  switching to `border-sky-deep`. **The lesson isn't "restart when something doesn't show" — it's
  that "restart and it's still broken" is itself a measurement**, one that rules the cache out and
  points at the code instead of inviting a second guess-and-restart cycle.

## What we would do differently

- Open the milestone in an actual browser before calling it done, not after the user's first try
  finds the bug a script couldn't. The Strict Mode race above is exactly the gap: every automated
  check passed and the component still failed on first real use.

- Enumerate a Yorkie op's *possible shapes* before writing a subscribe filter, not just the ones
  the feature being built happens to produce today. The `set` gap above existed from milestone 2's
  original subscribe callback — nothing needed it until milestone 3's `changeBlockType` started
  emitting one, and it went unnoticed for the same reason the Strict Mode race did: every
  automated check that talks to Yorkie directly (not through this specific component's remote
  peer path) had no way to exercise it.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- ...
