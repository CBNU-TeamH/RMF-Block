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

## What we would do differently

- Open the milestone in an actual browser before calling it done, not after the user's first try
  finds the bug a script couldn't. The Strict Mode race above is exactly the gap: every automated
  check passed and the component still failed on first real use.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- ...
