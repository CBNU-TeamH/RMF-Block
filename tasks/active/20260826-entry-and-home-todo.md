# Workspace entry and home

**Created**: 2026-08-26
**Issue**: closes [#22](https://github.com/CBNU-TeamH/RMF-Block/issues/22) and [#32](https://github.com/CBNU-TeamH/RMF-Block/issues/32)
**Design**: [`docs/ui/dashboard/dashboard.dc.html`](../../docs/ui/dashboard/dashboard.dc.html) screen 2,
the confirmed v0.4 artboard. No new `docs/design/` doc: [`api.md`](../../docs/design/api.md) already
catalogues what this touches, and the one thing it does not fix — the shape of the two JSON stores —
is four fields each and is written down below.

## Goal

One chain, end to end, and nothing past it:

> **join → home → see who else is connected → see the workspace's documents**

Documents are **fixtures on disk**, not something this task can create. The point is proving the
read path works: a file the server owns, rendered into the page, identical on the host's screen and
on a guest's second device. Opening a document is not part of this — there is no editor to open.

Plus the one screen that has to exist once members persist: **the host can see the workspace's
members and remove one** (UC-011, FR-011-01~03/07). Without it, a member record can be created and
never taken back.

## Entry flow — already built, do not rebuild

Checked before planning, because these are the two screens the chain runs between:

```
stdout link  → GET /api/auth/host?secret=…  → sets `role` cookie → 303 → /
guest        → GET /  (no cookie)           → redirect → /join
             → POST /api/workspace/join     → sets session cookie → /
either, back at /join while already inside  → redirect → /
```

`app/page.tsx` already branches on `isHost || member` and `app/join/page.tsx` already bounces people
who are inside, so there is no dead end in either direction. The join form already renders a red
`role="alert"` line on failure — milestone 1 makes it field-level, it does not build it from scratch.

One consequence worth knowing: the host reaches `/` *only* by opening the printed link. Typing
`IP:3000` in a fresh browser puts them on `/join` like anyone else — that is the design (`api.md`:
possession of the stdout secret is what proves host identity), not a bug.

Two asymmetries the home screen has to respect:

- The host has no `WorkspaceMember`, so `me` falls back to `HOST_PRESENCE` (`id: "host"`).
- `<SessionWatch />` renders only when `member` is set, so **the host holds no WebSocket at all**.
  Nothing in this task pushes over that socket, so it does not bite here — but it is why FR-021-06
  is not attempted (see **Cut**).

## Structure

`lib/documents/` and the member store follow `lib/chat/` — the domain-folder convention this repo
already uses (`lib/auth/`, `lib/chat/`, `lib/presence/`). The shell becomes
`app/(workspace)/layout.tsx`: a route group, so the URL stays `/` while the Members / Storage /
Settings screens can share it when they land. Not copied from the reference dashboards: their Redux
store and API client layer, which exist to serve an SPA talking to a remote server — the page is a
server component and reads the store directly.

## Milestones

### 0. `.data/` survives a container recreation

- **What**: a compose volume on `/app/.data` (#22).
- **Files**: `docker-compose.yml`, `README.md`.
- **Reuse**: the `mongo-data` volume already in the compose file is the same three lines. A **named**
  volume, not a bind mount: the Dockerfile does `chown node:node /app/.data`, and a named volume
  seeds ownership from the image while a bind mount would overwrite it with the host's and make the
  first write fail.
- **Why first**: milestone 2's whole point is surviving a restart, and the document fixtures live
  there too. Chat has been silently losing its history to `docker compose down` since it shipped.
- **Done**: `docker compose down && docker compose up --build` and `.data/` is still populated.

### 1. The join screen says what went wrong, in Korean

- **What**: a failed password marks the field, and picking a nickname someone is currently using
  asks first instead of silently kicking them.
- **Files**: `app/join/join-form.tsx`, `app/api/workspace/join/route.ts`,
  `lib/auth/session-registry.ts` (+ test).
- **Reuse**: the form already holds `error` state and renders a red `role="alert"` line. This adds
  `aria-invalid` and a red border on the field that failed and returns focus to it.
- **The 401 message becomes `비밀번호가 틀렸습니다.`** Its current wording, "The nickname or password
  is incorrect", carries a comment saying it stays vague so as not to "confirm nicknames to a
  stranger" — but that protects nothing, because **there is no such thing as a wrong nickname here**.
  `route.ts` checks the password first and never validates the nickname; an unknown one simply
  becomes a new member. The only failure this branch can represent is a wrong password, so naming a
  second field points the guest at something that cannot be at fault. The comment goes with it.
- **The rest of the form's copy goes Korean too.** The confirmed artboard is Korean throughout
  (`+ 새 문서`, `제목으로 검색…`, `N명 접속 중`) and the guests are Korean speakers, so Korean is the
  target — and a form with English labels and a Korean error is worse than either. `AGENTS.md` §5's
  English rule is about documents, not user-facing copy.
- **The takeover warning.** FR-020-08 makes a repeated nickname re-enter as that member and revoke
  the older device. That is right for one person on a second device and wrong for two people who
  picked the same name during the opening rush, where the first is thrown out mid-edit. The server
  cannot tell them apart — a nickname plus a password everyone shares is the only signal it has — so
  it stops guessing and asks: `sessionRegistry.isLive(nickname)` (readable from the
  `sessionByMemberId` map it already keeps), a `409 { reason: "nickname-live" }` for a request with
  no `force`, and a dialog offering **계속** (re-posts with `force: true`) or **다른 이름 쓰기**.
  This does not contradict FR-020-08 — that says what must happen on a repeated nickname, not that
  it must happen silently, and choosing another name means the case never arises. The 409 fires only
  after the password has passed, so a stranger learns nothing from it.
- **Done**: a wrong password shows the Korean message and marks only the password field; joining as
  a live nickname shows the dialog; **계속** takes the session over exactly as today; **다른 이름
  쓰기** leaves the other device signed in.

### 2. Members outlive the process

- **What**: a nickname keeps its member id and colour tag across a restart.
- **Files**: `lib/auth/member-repository.ts` (+ test), `lib/auth/session-registry.ts`.
- **Reuse**: three mechanisms from `lib/chat/chat-repository.ts`, and **nothing else from
  `lib/chat/`** — the promise chain that serializes writes, the write-then-rename, and the
  ENOENT-only-empty read. All three are load-bearing and each carries a comment saying what breaks
  without it: concurrent writes clobbering each other, a reader seeing a half-written file, and a
  permission error being swallowed as "no records" and then overwriting real ones. **Not reused**:
  `lib/chat/types.ts`'s `ChatRepository` / `ChatBroadcaster` interfaces and the `ChatService` layer,
  which serve a dependency-injection need this does not have — copying them would mean an interface
  with one implementation.
- **Record**: `{ id, nickname, colorTag, lastJoinedAt }` in `.data/members.json`. `lastJoinedAt` is
  stamped on every join — one line, since `join()` already runs then — and it is the only signal
  that tells a live member from a record nobody has used in a week. The Members screen renders it as
  최근 접속; adding it later would mean migrating records that already exist.
- **Sessions are not persisted.** A `sessionId` in a file would be a permanent bearer token on the
  host's disk. A restart signing everyone back in is correct, and it is already the documented host
  revoke path (`api.md`).
- **Known and accepted**: a nickname becomes claimable for the workspace's whole life rather than
  one process — anyone with the workspace password could take a name someone else used. That is
  already true within a session; persistence only lengthens the window, and per-user passwords are
  out of SRS scope (FR-020-03 has one workspace password). `MAX_MEMBERS` (64) likewise stops being
  cleared by a restart — which is what milestone 5 answers: the host removes a record they do not
  recognise, and `lastJoinedAt` is how they tell.
- **Done**: join as `alice`, `docker compose down && up`, join as `alice` again — same colour tag.

### 3. The home screen

- **What**: `/` renders the artboard's frame, the connected-user list, and the document list.
- **Files**: `app/(workspace)/layout.tsx`, `app/(workspace)/page.tsx` (moved from `app/page.tsx`),
  `app/(workspace)/document-list.tsx`, `lib/documents/documents.ts`, `app/globals.css`.
- **The document store is read-only here.** `lib/documents/documents.ts` is one function: read
  `.data/documents/documents.json`, return `[]` on ENOENT. About fifteen lines, no write path, no
  queue, no rename — there is nothing to serialize against. A record is
  `{ id, name, ownerId, createdAt, updatedAt }`; `id` is also the Yorkie document key for later
  (`api.md` §2 — no prefix, a Yorkie key cannot contain `:`). Fixtures are written by hand.
- **Why a file and not a constant in the component**: the thing being proved is that the *server*
  loads documents and every browser gets the same list. A hardcoded array proves neither, and when
  creation lands the reader is already correct — nothing gets thrown away.
- **Reuse**: `getWorkspaceName()` for the title and `<WorkspacePresenceList>` unchanged — the top bar
  gives it a place to sit, it does not rewrite it (see **Coordination**). Tailwind v4 is already
  configured; the artboard's palette becomes `@theme` tokens rather than repeated hex.
- **Why a layout and not components**: the artboard's Members / Storage / Settings screens share this
  exact shell. A Next layout is the platform's own answer and does not re-render when navigating
  inside the group, which a hand-composed `<TopBar />` would.
- **Yorkie does not gate the page.** The list comes from `.data/`, so a browser that cannot reach
  Yorkie still gets a working screen and loses only presence. Blocking entry on `activate()` would
  turn a firewall between a guest and port 8080 into a blank page.
- **Connection state is one dot** in the top bar. `WorkspacePresenceList` currently replaces its
  whole render with `Connecting to Yorkie…` or `Yorkie is not reachable at <address> — <reason>`,
  which does not fit a presence slot in a 44px bar. The dot carries reachable / not, and
  `// ponytail: console.log until someone asks for a real error surface` takes the detail.
- **Rows do not navigate.** No `<a>`, no `cursor: pointer` — there is no editor to open, and a link
  that goes nowhere is worse than a row that never offered. `+ 새 문서` and the type filter render
  as disabled for the same reason. Search filters the rows it has, which costs three lines and works.
- **Done**: the frame matches the artboard at 1280 wide; the fixture documents render on the host's
  screen and on a guest's second device identically; Storage and Settings are visibly disabled
  (Members lights up in milestone 5); an empty `.data/` shows an empty state rather than a bare
  header row.

### 4. The presence file, in one pass

- **What**: three changes in one file, cheaper together than apart.
  1. `client.attach()` no longer runs after the component unmounted (#32).
  2. The roster shows a spinner for the whole `activate → attach → subscribe → first read` window
     instead of flashing an empty list.
  3. The Yorkie client moves up into a provider in `app/(workspace)/layout.tsx`, and
     `WorkspacePresenceList` becomes a consumer of it.
- **Files**: `app/workspace-presence.tsx`, `app/(workspace)/layout.tsx`.
- **Why (3), and why milestone 5 waits for it**: the Members screen's 상태 column is live
  online/offline, which only the Yorkie roster knows. A second component opening its own
  `yorkie.Client` would mean two connections per browser — the exact thing the connected-user-list
  task deleted `app/yorkie-status.tsx` to avoid. One client in the layout, read by both the top bar
  and the members table, is the only shape that does not regress that. It is also the
  "split the status out" cleanup that task left open, so it is finishing their work rather than
  cutting across it.
- **Reuse**: `app/spike/prosemirror/page.tsx` already solved the ordering — it holds the setup
  promise and tears down after it settles. Carry that shape over rather than inventing a second one.
- **Done**: a StrictMode mount/unmount/mount leaves exactly one attached client and no ghost member
  in a second browser's roster; the roster never renders empty-then-populated; the browser holds
  exactly one Yorkie connection with two components reading it.
- **Ordering** — see **Coordination**. This rewrites another task's file, so it waits for that merge.

### 5. The Members screen

- **What**: the host sees every member the workspace has recorded and can remove one.
- **Files**: `app/(workspace)/members/page.tsx`, `app/(workspace)/members/member-table.tsx`,
  `app/api/workspace/members/[memberId]/route.ts`, `lib/auth/session-registry.ts`.
- **Design**: `dashboard.dc.html` screen 3, redrawn on import to columns this project can actually
  answer — see [`docs/ui/dashboard/source.md`](../../docs/ui/dashboard/source.md).
- **Reuse**: nothing new is needed for the hard parts. `wsHub.revoke(sessionId)` already ends a
  device's session and tells it why — the takeover path calls it today. `isHostSecret()` already
  gates the host, as `app/page.tsx` and `app/join/page.tsx` do. The roster comes from milestone 4's
  provider, not a second Yorkie client.
- **The columns**: 이름 and 최근 접속 from `.data/members.json`; 역할 is **derived** — every record
  in that file joined through the guest form, and the host is the synthetic `HOST_PRESENCE`, so
  there is no role field to store; 상태 is the live roster cross-referenced by member id.
- **One action, not two.** Removing a member deletes the record *and* revokes the session if there
  is one. Splitting "kick" from "delete record" would be two buttons for one intent, and the offline
  case — the stale record nobody recognises — falls out of the same action with no session to end.
  FR-011-02 requires a confirmation, so it gets one.
- **The host's own row has no action**, and neither does anyone else's for a guest: FR-011-07.
  `DELETE` returns 403 to a non-host regardless of what the UI renders.
- **Known limit, stated in the UI**: a removed guest can rejoin immediately, because the workspace
  password is the only credential and it has not changed. FR-011-04~06 (password change) is the half
  that makes removal stick, and it is not in this task — see **Cut**. The confirmation says so
  rather than implying a permanence the system cannot deliver.
- **Done**: the host removes a connected guest, that guest's device lands back on `/join`
  (FR-011-03) and drops out of everyone's roster; the host removes an offline record and it is gone
  after a restart; a guest calling the endpoint directly gets 403.

## Acceptance

- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass, and both CI checks are green on the PR.
- [ ] A wrong password shows `비밀번호가 틀렸습니다.`, marks the password field, and keeps the
      nickname typed.
- [ ] Joining as a nickname that is currently live shows the dialog; **다른 이름 쓰기** leaves the
      other device signed in; **계속** revokes it exactly as today.
- [ ] `docker compose down && docker compose up --build`, then join as the same nickname — same
      colour tag, and the fixture documents are still listed.
- [ ] A second device on the LAN joins and sees the same document list and the same roster.
- [ ] Stopping the Yorkie container leaves `/` rendering its document list, with the top-bar dot
      showing not-connected.
- [ ] A mount/unmount/mount cycle leaves no ghost member in a second browser's roster.
- [ ] The host removes a connected guest: that browser lands on `/join`, and the guest disappears
      from the other browsers' rosters without a reload.
- [ ] A guest `curl`ing `DELETE /api/workspace/members/<id>` gets 403.
- [ ] Removing an offline member survives a restart — the record is gone, not back.
- [ ] The browser holds exactly one Yorkie connection with both the top bar and the members table
      reading from it.
- [ ] The screens match `dashboard.dc.html` screens 2 and 3 at 1280 wide, minus the cut columns.

## Cut

Named here so nobody re-adds them by accident.

- **Opening a document.** Rows are inert. There is no editor until the block work (FR-022, Phase 1),
  and a row that looks clickable and goes nowhere is worse than one that never offered.
- **Creating documents — all of FR-021.** No `POST /api/documents`, no name-collision suffix, no
  write path in `lib/documents/`. Fixtures are edited by hand. This task therefore satisfies **no
  FR-021 requirement**; it proves the read path and the screen, nothing more.
- **Realtime tree reflection (FR-021-06).** Nothing creates a document, so there is nothing to
  announce — and the browser's only socket lives in another task's file and does not render for the
  host at all.
- **Changing the workspace password (FR-011-04~06).** It is the other half of UC-011 and the half
  that makes a removal stick — without it a removed guest simply rejoins with the password they
  already have. It stays out because it moves the password from an environment variable into
  `.data/`, which changes the startup contract (`WORKSPACE_PASSWORD` becomes a seed, not the source
  of truth) and deserves its own task rather than riding along with a screen.
- **The Storage and Settings screens.** Phase 2, and their nav items ship disabled.
- **The "Here now" column.** Needs `documentId` on presence — the FR-040 half of `api.md` §4.1 that
  nothing implements, and a change to the presence contract.
- **Folders and the document tree.** The confirmed artboard shows a flat list, so `parentId` buys
  nothing. FR-021-02 and all of FR-023 stay in Phase 2.
- **Per-user passwords.** They would make the takeover dialog unnecessary by making identity real,
  and the SRS has one workspace password (FR-020-03).
- **STARRED, the 🔔 bell, pagination, and the type filter.** No FR, no UC; eight users do not
  paginate; every document is the same type until file blocks exist.

## Coordination

`app/workspace-presence.tsx` and `app/session-watch.tsx` are the connected-user-list task's files and
that task is still open. Milestones 0–3 **place** the presence component and do not restyle or move
it. Milestone 4 does rewrite it — lifting the Yorkie client into a provider is a real change to
their file, not a cosmetic one — so **milestone 4 cannot start until that task has merged.** It is
the cleanup that task itself left open as item 1, so it is finishing their work rather than cutting
across it, but it is still theirs to hand over first. Milestone 5 depends on milestone 4.

Milestone 3 also **moves `app/page.tsx`** into the route group, which is the change git merges worst.
Do that move after the other task has merged, or agree on it first.

## Cross-cutting

- **Requirements**: FR-020-05 (retry on a wrong password), FR-020-06 (the *display* of the document
  tree and the connected-user list), FR-020-08 (takeover, now with a confirmation in front of it),
  and FR-011-01 / 02 / 03 / 07 (select a guest and remove them, confirm first, end their connection,
  refuse a non-host). **No FR-021 requirement is satisfied**, because nothing here creates a
  document; see **Cut**.
- **Roadmap**: this is Phase 0's exit criteria finally rendered as a screen, the read half of what
  Phase 2 will own, and the guest-kick half of UC-011 — also Phase 2. `ROADMAP.md` is not edited:
  the phases still contain what they contained, this task just reaches into two of them for the
  parts these screens cannot do without.
- **Issues**: closes #22 (milestone 0) and #32 (milestone 4).
- **Docs that go stale**: `architecture.md` §3(d) says auth records are "planned to follow the same
  pattern" as chat — after milestone 2 they do, and ADR-002 §2's "chat is the only one of the three
  actually persisting there so far" stops being true. `api.md`'s `GET /api/workspace` row stays
  target design and is **not** implemented here.

## Review

Filled in at the end.
