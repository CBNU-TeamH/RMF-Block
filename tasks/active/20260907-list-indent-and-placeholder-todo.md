# List nesting with Tab, and a placeholder that reveals the `/` menu

**Created**: 2026-09-07
**Issue**: none — both are SRS/UX gaps found while surveying the editor, not reported bugs.
**Design**: [`docs/design/document-editing.md`](../../docs/design/document-editing.md), "Block types" §List block (the `depth` field it already specifies) and "Editing surface".

Two small gaps that both make an existing capability reachable rather than adding a new one.

**Why together**: they are the two cheapest items on the editor survey, they touch the same two
files, and neither is worth its own review round. If either grows, it splits.

## Milestones

### 1. Tab / Shift+Tab nests a list item

- **What**: `Tab` indents the focused list block one level, `Shift+Tab` outdents it. The SRS
  already requires this — §4.1 says a 목록 블록 "항목을 들여쓰기하여 중첩(하위 목록)할 수 있다" —
  and `depth` is already in the schema, in `changeBlockType`'s `TypeFields`, and in `OWNED_FIELDS`.
  **Nothing can set it.** This is wiring, not new modelling.
- **Files**: `lib/blocks/indent.ts` (new, pure), `lib/blocks/indent.test.ts` (new),
  `lib/blocks/list-numbering.ts`, `app/(workspace)/documents/[id]/text-block.tsx` (key handler),
  `app/(workspace)/documents/[id]/editor.tsx` (handler + indent rendering).
- **Reuse**: `changeBlockType` already writes `depth` and clamps it to `>= 0`; `idBeforeInOrder`
  already answers "what is above this block" for merge and arrow-key navigation. The new pure
  module is the *rule*, not the plumbing.
- **Done**: on a document with two bullets, pressing Tab on the second indents it and Shift+Tab
  returns it; a third bullet under an indented one can reach depth 2 but not depth 3.

**The rule worth writing down.** Indent is not `depth + 1` unconditionally: a block may not end up
more than one level deeper than the block above it, or it renders as a child of nothing. So the
new depth is `min(depth + 1, previousListDepth + 1)`, and a list block with no list above it
cannot indent at all. Outdent is `max(depth - 1, 0)`. This is the whole of `indent.ts`, and it is
pure, so it is tested without a browser like `reorder.ts` and `text-surface.ts` already are.

**Tab is intercepted only on a list block.** Everywhere else it keeps its default, which moves
focus — trapping Tab inside every textarea would leave a keyboard user unable to leave the editor.
This is a deliberate accessibility trade-off, not an omission.

**Checklist does not nest, on purpose.** SRS §4.1 gives nesting to 목록 블록 only, and `TypeFields`
carries `depth` only on `list`. Extending it to checklist is a model change and an SRS question,
so it stays out until the team asks for it.

### 2. Ordered numbering becomes depth-aware

- **What**: an ordered item at depth 1 starts its own `1.`, and returning to depth 0 continues the
  outer sequence where it left off.
- **Files**: `lib/blocks/list-numbering.ts`, `lib/blocks/list-numbering.test.ts`.
- **Reuse**: the function exists and is already called once per render from `editor.tsx`. Its own
  header says *"Depth is ignored: nothing yet lets a list item nest"* — milestone 1 makes that
  sentence false, so this is the same change, not a follow-up.
- **Done**: `1. / 1. / 2.` for an outer item, an indented item, and a second outer item.

### 3. An empty text block says how to reach the `/` menu

- **What**: a focused, empty text block shows `'/' 를 입력해 명령어 사용`.
- **Files**: `app/(workspace)/documents/[id]/text-block.tsx`.
- **Reuse**: the `/` menu shipped in #63 and works. Nothing in the UI says it exists, so the
  feature is unreachable unless you already know about it. This is discoverability for something
  already built.
- **Done**: clicking into an empty paragraph shows the hint; typing hides it; a non-empty or
  unfocused block never shows it.

**Only on the plain text variant, and only while focused.** A heading, quote or code block gets
nothing — their own styling already says what they are, and a placeholder on every empty block at
once is noise rather than help.

## Acceptance

- [ ] `pnpm test` — new unit tests for `indent.ts` cover: indent past the cap is refused; a list
      with no list above it cannot indent; outdent floors at 0; a non-list block returns `null`.
- [ ] `pnpm test` — `list-numbering` tests cover the depth-aware sequence above.
- [ ] `npx tsc --noEmit`, `pnpm lint`, `pnpm build` clean.
- [ ] `pnpm verify:docs` still exits 0.
- [ ] Two browsers on one document: indenting a bullet in one appears in the other, and the
      indent survives a reload (it is a CRDT field, not local state).
- [ ] Tab still moves focus out of a paragraph that is not a list.

## Cross-cutting

- **SRS**: satisfies the nesting half of §4.1's 목록 블록 row. No new requirement, no SRS change.
- **Docs**: `document-editing.md` §List block currently describes `depth` as stored-but-unset —
  that sentence goes stale here and must be updated in the same PR, along with the indent rule
  above, which is a decision the code alone does not explain.
- **`list-numbering.ts`'s header comment** claims depth is ignored. Milestone 2 makes it false.
- **Presence/focus**: none. Indent changes a block's `content.depth`, which rides the same
  `remote-change` path every other field already does.

## Review

**Shipped**: all three milestones, plus one fix the work turned up.

`lib/blocks/indent.ts` (new, pure) holds both rules: `indentedDepth` for the Tab move, and
`preservingDepth` for the bug below. 18 new unit tests; suite 349 → 373.

**The fix that was not planned.** `changeBlockType` treats `TypeFields` as the whole target state
and drops any field it does not name — `depth` included. Invisible while `depth` was always 0;
the moment Tab could set it, the `/` menu and a markdown marker each silently flattened an
indented item. `preservingDepth` carries the depth at the two call sites, which keeps
`changeBlockType`'s contract rather than special-casing the operation itself.

**Verified in the browser**, against Yorkie in Docker, with real keyboard input:

| | |
| --- | --- |
| Tab on an item with a list above it | indents to 24px, caret kept |
| A second Tab on the same item | refused — the cap by the block above holds |
| Shift+Tab | back to 0px, caret kept |
| Tab in a plain paragraph | focus moves to the next control, text unchanged |
| Placeholder | renders on an empty text block, absent elsewhere |
| Reload | the indent is still there — the write reached Yorkie |
| A second browser, loaded fresh | renders the indent — the read path works |

**Not directly observed**: live propagation to an *already open* peer, without a reload. Blocked by
the browser harness, not by the code — coordinate clicks landed off-target under a device-pixel
mismatch, and a background tab never took focus, so no keypress could be delivered to the second
client. Both halves of the round trip are proven separately above, and the subscription path
(`touchesBlockList` matching `$.blocks.*`) is untouched by this task. **Worth one manual check
before merge.**

**Cut**: nothing.

**Moved to another task**: nesting for checklist blocks — SRS §4.1 gives nesting to 목록 only, and
`TypeFields` carries `depth` only on `list`, so it is a model change and an SRS question.
