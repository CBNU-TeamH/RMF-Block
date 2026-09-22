# Document version history on Yorkie's Revision API

**Created**: 2026-09-22
**Issue**: #23 (the FR/UC gap it records stays open — team agreement, `AGENTS.md` §5)
**Design**: `docs/design/architecture.md` §3(c) and `docs/adr/002-persistence-on-yorkie-mongo.md`;
a dedicated `docs/design/version-history.md` lands with milestone 7 if the behaviour needs a home.

WBS 6.5. Measured 2026-09-21 against this project's own stack (Yorkie 0.7.13 + MongoDB): automatic
revisions already run with zero app code (`autoRevisionEnabled`, `snapshotInterval`/`snapshotThreshold`
500), `restoreRevision` converges peers on its own, `listRevisions` returns metadata only, there is
no delete API, and restore does **not** create a safety revision. So this task is not "build history"
— it is the four things Yorkie does not give us.

Revision methods are `Client` methods taking an attached `Document`. `editor.tsx:105` already holds
`client` from `useWorkspacePresence()`, and `useBlockDocument` returns `docRef` — the pair is already
in scope, so no server-side Yorkie client is built. A server REST relay would not be a permission
boundary anyway: a guest holds an activated client in the browser and can call
`client.restoreRevision(doc, id)` from devtools. The webhook is the only real boundary.

## Milestones

### 0. Measure what the design still guesses at (no commit)

- **What**: settle four unknowns before writing code that assumes an answer.
- **Files**: throwaway probe scripts in the scratchpad; findings recorded in this task's lessons.
- **Reuse**: `scripts/verify-auth.mjs` is the precedent for probing a running stack, including
  (`:55-57`) using a fresh document key per attempt to defeat Yorkie's 10s auth cache.
- **Done**: four answers written into the lessons doc:
  - (a) does `YSON.parse` survive a snapshot of *our* document shape — blocks array, `yorkie.Text`,
    and text containing `]`, `[1]`, a markdown-style bracket-paren link, quotes, CJK/emoji? The
    2026-07-28 spike's
    "a bullet list throws" was the `Tree(...)` pattern's brace ceiling, and this repo's root has no
    Tree (ADR-007). Our path is `Text(...)`, bracket-bounded, and our text is one bracket deep. The
    live risk is that the regex does not know it is inside a JSON string. **This gates milestone 6.**
  - (b) after *this* client restores, does its own view update? `doc.subscribe`
    (`use-block-document.ts:118-158`) only acts on `remote-change` / `local-change`+`undoredo`, and
    judges staleness with `touchesBlockList`, which accepts `$.blocks` and `$.blocks.*` but **not a
    bare `$`** (`lib/blocks/text-surface.ts:58-60`). Restore is a whole-root write. Peers were
    already measured converging; the restoring client is the unknown.
  - (c) the exact webhook spelling of the four revision methods. The webhook vocabulary differs from
    the RPC names (`PushPull` vs `PushPullChanges`), and a wrong name fails `UpdateProject` outright
    (`lib/yorkie-admin.ts:16`) — which is the cheap oracle.
  - (d) what `label` an automatic revision carries, since classification keys off it.

### 1. Task docs and probe findings

- **What**: this pair, plus (0)'s answers, on the branch before any code.
- **Files**: `tasks/active/20260922-version-history-{todo,lessons}.md`, `tasks/README.md` (generated).
- **Reuse**: `tasks/templates/`; `pnpm tasks:index` regenerates the index.
- **Done**: `pnpm verify:docs` clean with the pair in place.

### 2. Webhook guard — the permission boundary

- **What**: `RestoreRevision` becomes host-only; the other three require only a live session.
- **Files**: `lib/yorkie-admin.ts` (`GUARDED_METHODS`),
  `app/api/internal/yorkie/auth/route.ts`, plus a new `route.test.ts`.
- **Reuse**: the route's existing `allow()` / `deny()` helpers and `HOST_SESSION_PREFIX`. Response
  shape is strict — 200+allowed, 401+refused, 403+refused, and nothing else; `200` with
  `allowed:false` is a malfunction, not a refusal (`docs/design/api.md:298-302`).
- **Done**: a guest's `RestoreRevision` is refused and a host's is allowed, both asserted; adding
  the four names to `GUARDED_METHODS` alone is shown to change nothing (the handler never read
  `body.method` before this).

### 3. A host signal the client can see

- **What**: expose `isHost` on the presence context.
- **Files**: `app/(workspace)/layout.tsx`, `app/(workspace)/presence-provider.tsx`.
- **Reuse**: `layout.tsx:46` already computes `isHost` via `isHostSecret` and discards it; `:62-67`
  already passes `colorTag`/`memberId`/`nickname` into the provider.
- **Done**: `useWorkspacePresence().isHost` is true for the host and false for a guest. Not a
  security control — hiding a button is not a boundary; milestone 2 is.

### 4. Revision list

- **What**: a panel listing revisions, classified and grouped by date, with a display cap and paging.
- **Files**: new `app/(workspace)/documents/[id]/version-history.tsx`, a pure grouping/classifying
  module under `lib/documents/` with its test, a trigger in `editor.tsx`.
- **Reuse**: the plain-fixed-overlay idiom at `editor.tsx:1049-1090` (rendered only while open, so
  the fetch that fills it cannot land in a panel nobody asked for); `Intl.DateTimeFormat("ko-KR", …,
  timeZone: "Asia/Seoul")` — the zone is pinned for the hydration reason written at
  `document-list.tsx:26-31`; the existing empty/loading/error idioms (`text-ink-faint` centred,
  `text-red-600` + `role="alert"`, `여는 중…`). No spinners or skeletons exist in this repo.
- **Done**: the panel lists a document's revisions grouped by day; retention is "show the most
  recent N" with a 더 보기 control, because there is no delete API. This is the repo's first paging
  idiom.

### 5. Restore, safety revision, and the undo floor

- **What**: host restores a revision, reversibly, without leaving a stale undo stack behind.
- **Files**: `version-history.tsx`, `use-block-document.ts`.
- **Reuse**: `<dialog>` + `showModal()` for the confirmation, per `document-actions.tsx:62-77`
  (destructive, so it wants the focus trap); `readBlocks` for the post-restore recompute if (0b)
  says the restoring client needs one.
- **Done**: order is create-safety-revision → restore → recompute if needed → **re-floor the undo
  stack**. The last one is a bug this task found: `undoFloorRef` is written at exactly one place
  (`use-block-document.ts:114`, right after attach) and restore does not touch it, so `Ctrl+Z`
  after a restore replays reverse ops recorded against the pre-restore document.

### 6. Read-only preview — only if (0a) passed

- **What**: render a past revision's snapshot without letting anyone type into it.
- **Files**: a small display-only component beside `version-history.tsx`; a narrow YSON extractor
  under `lib/blocks/` with its test.
- **Reuse**: the presentation-only helpers that already exist — `variantOf` (`editor.tsx:69`),
  `indentOf`/`INDENT_STEP` (`:92-98`), `orderedListNumbers` (`lib/blocks/list-numbering.ts`),
  `BLOCK_KINDS[type].surface` (`lib/blocks/registry.ts:29`), `isTextBearing`.
- **Done**: no `readOnly` prop is added to any of the six existing block views — all six are
  write-coupled (`TextBlockView` takes `docRef` and calls `doc.update()` itself; the five non-text
  views require `onDelete`), and branching them would not be a surgical change. The extractor pulls
  `id`, `type` and plain text only; it does not rebuild a CRDT. wafflebase's restore half (assigning
  plain values onto the root) is deliberately not copied — the spike doc warns against it.

### 7. Docs

- **What**: bring the three "open — decide before building this" notes in line with what shipped.
- **Files**: `docs/design/architecture.md` §3(c), `docs/adr/002-persistence-on-yorkie-mongo.md`,
  `AGENTS.md` §7; possibly a new `docs/design/version-history.md` + an `AGENTS.md` §4 routing row.
- **Reuse**: n/a.
- **Done**: `docs/SRS-ko.md` is **unchanged**. The FR draft, UC draft, and the §2.1 diagram
  amendment (lines 232-233 show the server calling the revision API; the implementation has the
  client calling it under webhook authorisation) go to #23 as a proposal for the team.

## Acceptance

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` pass.
- [ ] `pnpm verify:docs` clean.
- [ ] `pnpm comments` and `pnpm comments --strict` both pass — this task is also the trial run of
      the 30% threshold and the ratchet staged on this branch.
- [x] Webhook gate asserted **in both directions** — revised from the original host-only design:
      restore ended up open to every live session (`docs/design/version-history.md`, "Who may
      restore"), so the two directions that matter are session-liveness, not role. Verified in the
      container: the app's own issued token succeeds on all four revision methods; a token the app
      never issued is refused `unauthenticated`.
- [x] Paging boundary tested at exactly its value (`docs/testing.md:25-26`) — the design changed
      from a display cap to unlimited on-demand paging (`isOldestPage`), so this is now
      `revisions.test.mts` asserting `isOldestPage` at exactly `REVISION_PAGE_SIZE` and at
      `REVISION_PAGE_SIZE - 1`.
- [x] Container check, because milestone 2 is an auth change (`AGENTS.md` §2): the guest-refused /
      host-allowed split no longer applies (restore is open to everyone). What was actually
      measured with two live Yorkie clients: after client A restores via `replaceBlocks`'s two
      `doc.update()` calls (not `client.restoreRevision`), client B converges to the identical
      state through ordinary sync; `doc.history.undo()` on A afterward throws nothing and two
      presses recover the exact pre-restore state (one `doc.update()` per press, in reverse order).

## Cross-cutting

- **SOIR003** (`docs/SRS-ko.md:1143-1151`) is the only requirement row this traces to. There is no
  FR and no UC for version history — that is #23, and it needs team agreement, so nothing here
  edits the SRS.
- Milestone 2 changes the premise behind `docs/testing.md:141-143`, which lists
  `internal/yorkie/auth` as a route that gets no gate test because it is self-authenticating. Once
  it branches on method it is no longer only that, so the exemption should be revisited there.
- Milestone 3 adds a field to the presence context, which `focus-share.tsx` and `presence-stack.tsx`
  also consume.
- `#28` (a removed document's revision ids become unreachable) stays out of scope: the app never
  calls `client.remove()`, so it does not trigger today.
- `#92`'s comment-budget promotion (earliest 2026-09-23) overlaps this task by a day; the staged
  threshold/ratchet change is being exercised here rather than decided in the abstract.

## Review

Filled in at the end.
