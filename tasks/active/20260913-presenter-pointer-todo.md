# Presenter pointer — fading laser pointer

**Created**: 2026-09-13
**Issue**: #95 (second of its two PRs; block-anchored freehand marks is the first, #96)
**Design**: [`docs/design/presence-and-focus.md`](../../docs/design/presence-and-focus.md) — "The
ink layer" gains the pointer's own subsection.

FR-030-12/13/14's other half: a presenter shows followers where they're pointing right now — a
dot that fades a couple seconds after it stops moving, not a permanent mark. Branched off
`feat/presenter-marks` (PR #96, not yet merged) rather than `main`, so this can start immediately
instead of waiting; rebase onto `main` once #96 merges.

Decided this session, reshaping the design from what #95 originally sketched: **while the pointer
tool is selected, the presenter is read-only** — clicking or typing is blocked, exactly like
밑줄/형광펜 already do. That one decision means the pointer needs no new capture mechanism: the
SVG already captures every pointer event while any tool is selected, so this is a third branch on
existing handlers, not a parallel architecture.

## Milestone 6, folded in after manual testing

Manual testing surfaced two more items, both addressed on this same branch (the second was
initially planned as a separate issue/task per AGENTS.md §6's one-task-per-branch rule — the user
explicitly asked for it here instead, overriding that default):

- **`TRAIL_MS` shortened**, 2500ms → 1500ms — seen live, the original "~2-3s" read as lingering.
- **`FocusShare` only ever surfaced one presenter.** `members.find((m) => m.presenting != null)`
  picked one arbitrarily (Yorkie's roster iteration order) when two members presented from
  different documents at once — not a crash (verified: the dashboard never reads presence state,
  and every focus/ink DOM query is unreachable outside `/documents/[id]` or null-guarded), but a
  silent discoverability gap: the second presenter was never offered as a 참여하기 option to
  anyone, on any page. Fixed with a small dropdown when `presenters.length > 1`, minimal relative
  to the fuller "다중 발표자" card-grid already sketched (unbuilt) in
  `docs/ui/app-shell/app-shell.jsx` — this makes every presenter *reachable*, not that design.

## Milestone 7, second round after manual testing

Two more, direct from the browser test of milestone 6:

- **Pointer color fixed to red** (`#dc2626`, matching this app's own error-red rather than the
  guest roster's rotating one), not the presenter's own `colorTag` — a laser pointer reads as a
  laser pointer regardless of whose hand is on it. Marks keep each presenter's own color; only
  the pointer changed.
- **공유하기 hidden outside a document, not disabled.** Reverses a decision from before this
  session (`presence-and-focus.md`'s old reasoning: hiding it would make it pop in and out on
  every navigation). Revisited directly: the workspace only has one other route shape today (the
  dashboard) to pop in and out against, not the many the old reasoning pictured.

## Milestones

### 1. Trail geometry

- **What**: a received point becomes a `TrailPoint` (stamped with this browser's own arrival
  time), and ages out after `TRAIL_MS`.
- **Files**: `lib/focus/ink.ts`, `lib/focus/ink.test.mts`.
- **Reuse**: `InkPoint`/`inkPointAt`/`inkPixelsFor` — a pointer position is anchored exactly like a
  mark's points, no new coordinate math.
- **Done**: `pnpm test` green, including the exact `TRAIL_MS` boundary.

### 2. Presence

- **What**: `BlockPresence` carries `pointer?: InkPoint | null`; `inkFrom` returns it alongside
  `marks`/`colorTag` from the same gated entry.
- **Files**: `lib/presence/occupancy.ts`, `lib/presence/occupancy.test.mts`.
- **Reuse**: the exact visibility gate marks already use — one followed-presenter lookup, not two.
- **Done**: a non-follower and a follower-of-someone-else both see `pointer: null` via the existing
  gate tests, extended.

### 3. Publish

- **What**: a third toolbar tool, "포인터"; moving the pointer while it's selected publishes a
  throttled position; deselecting it (or ending the share) clears it for followers.
- **Files**: `app/(workspace)/documents/[id]/ink-overlay.tsx`.
- **Reuse**: `schedulePublish`/`PUBLISH_MS`/`shouldAcceptPoint`/`lastAcceptedPixelRef` — the same
  throttle marks already use, generalized to compose `{marks, pointer}` in one write rather than
  scheduling two.
- **Done**: presenter selects 포인터, moves the mouse, clicking/typing is blocked while it's
  selected and free again once deselected; a follower sees the dot move.

### 4. Render + fade

- **What**: the follower's own local trail buffer, pruned on arrival and on a plain interval so it
  also fades when the presenter has stopped moving; rendered as aging circles plus one
  CSS-transitioned head dot.
- **Files**: `ink-overlay.tsx`.
- **Reuse**: `inkPixelsFor` per point, the `MarkShape`/`memo` pattern already established.
- **Done**: two browsers, a moving pointer looks like a smooth fading trail, not a stepped or static
  one; it disappears within ~`TRAIL_MS`ms of the presenter stopping.

### 5. Docs

- **What**: the ink layer's design doc section gains the pointer's own reasoning and the
  measured cost table (pointer riding alongside marks at 10Hz).
- **Files**: `docs/design/presence-and-focus.md`.
- **Done**: `pnpm verify:docs` clean.

## Acceptance

- [ ] A follower sees the presenter's pointer move in close to real time
- [ ] The pointer fades within ~`TRAIL_MS` of the presenter stopping, without lingering
- [ ] Clicking or typing is blocked on the presenter's own screen while 포인터 is selected
- [ ] Deselecting 포인터 (or picking a drawing tool) immediately restores normal editing
- [ ] Ending the share, and the presenter disconnecting, both clear the pointer for every follower
- [ ] A non-follower with the document open sees nothing
- [ ] A follower who is following someone *not* using the pointer sees nothing
- [ ] Nothing appears in the block document or in `.data/`
- [x] `pruneTrail` holds at the exact `TRAIL_MS` boundary (unit test)
- [x] `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm comments`, `pnpm verify:docs` pass

Added once folded into the same branch (milestone 6):

- [ ] Two members presenting from two different documents at once are **both** reachable — a
      dropdown, not just the first found
- [ ] Picking a different name in the dropdown and clicking 참여하기 navigates to *that*
      presenter's document, not whichever was first
- [ ] A presenter in the dropdown ending their share does not leave the selection pointed at a
      gone entry — it falls back to whoever's left
- [ ] With exactly one presenter, the control looks exactly as it did before (single button, no
      dropdown) — the common case is unchanged

## Cross-cutting

- **SRS**: FR-030-12/13/14 (UC-030 E3-4), completing what #96 left open.
- **Cost, checked not assumed**: measured (not estimated) — pointer field alone ~88B; realistic
  marks (3 typical strokes) + pointer ~1.9KB/publish (~19KB/s at 10Hz); worst-case marks (16 maxed
  300-point strokes) + pointer ~125KB/publish (~1.25MB/s at 10Hz, unchanged in kind from what #96
  already accepted — the pointer adds 88 bytes to an already-documented ceiling, not a new one).
- **Not in scope**: FR-030-06 (locking a *follower's* editing) is still unbuilt, its own issue.
- **Verified against the container**, not `pnpm dev`: presence, per AGENTS.md.
- **Depends on #96**: branched from its tip rather than `main`; rebase once it merges.

## Review

Filled in at the end.
