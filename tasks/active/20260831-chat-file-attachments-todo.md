# Chat file attachments

**Created**: 2026-08-31
**Issue**: —
**Design**: [`docs/design/api.md`](../../docs/design/api.md) §1 already catalogues
`POST /api/chat/files`, `GET /api/files/:id/preview` and `GET /api/files/:id/download`, and
[`docs/design/chat.md`](../../docs/design/chat.md) names attachments as "additive
`content`-style fields on `ChatMessage`". No new design doc; the two decisions those leave
open — where bytes live, and what a response may claim they are — are settled below.

## Goal

UC-060 end to end with a file in it: pick a file, send it, and everyone in the workspace
sees it appear in the chat — an image as an image, anything else as a card they can
download. FR-060-02, and the "첨부 파일 정보" half of FR-060-04/05.

Out of scope, each with a reason:

- **The file drawer (UC-061, FR-061-01~04)** — its own branch. UC-061's 비고 says uploads
  happen *only* through chat, so it needs this first, and it is a screen rather than a
  pipeline.
- **Document/block link attachments (FR-060-03/06)** — a different kind of attachment
  with no bytes. The `attachment` field below is shaped so it can join without a rewrite.
- **The in-app viewer (UC-080)** — `preview` here serves an image so a browser can render
  it. Rendering a PDF page is that use case's job.
- **Thumbnailing.** Originals are served as-is. Eight people on a LAN, and a resize step
  means a native image dependency.

## Milestone 0 — chat has no idea who is talking

Not planned as part of this feature. Found while planning it, and it has to come first.

```ts
// app/api/chat/route.ts
const sender = typeof body?.sender === "string" ? body.sender : undefined;
```

`sender` comes from the request body, and the route checks no session at all — there is no
`middleware.ts` either. So this works today, from anything on the LAN, without joining the
workspace or knowing its password:

```bash
curl -X POST http://<host>:3000/api/chat \
  -H 'content-type: application/json' -d '{"sender":"호스트","text":"…"}'
```

`chat.md` knew: *"`sender` is client-supplied for this slice… It becomes server-derived
once this module is wired to it."* Guest login shipped afterwards and the wiring never
happened.

**Why it blocks the rest**: FR-061-02 requires the file list to show 전송 사용자. Building
that on a name the sender picks means presenting an unauthenticated claim as a fact. The
fix is the caller-side change `chat.md` predicted — `ChatService` and `ChatMessage` are
untouched.

- **Files**: `app/api/chat/route.ts`, `lib/chat/types.ts` (drop `sender` from the input).
- **Done**: posting without a session is 401; `sender` is the session's nickname and a
  `sender` in the body is ignored.

## Milestone 1 — a file store both chat and documents can use

- **What**: bytes on disk, metadata in JSON, under `.data/`.
- **Files**: `lib/files/types.ts`, `lib/files/file-repository.ts` (+ tests).
- **Reuse**: `lib/chat/chat-repository.ts`'s write-then-rename and ENOENT-only-empty read.
  Not its promise queue — metadata appends are serialized the same way, so that part is
  carried over too.

```
.data/files/<fileId>      the bytes, named by id
.data/files.json          [{ id, name, type, size, uploadedBy, uploadedAt, origin }]
```

**The id is the filename on disk, never the uploaded name.** A name is attacker-controlled
and `../../` is a valid string.

**One store, shared with document files (FR-022-13/14) when those land**, with `origin`
recording which. `api.md` already points FR-061-04 (chat) and FR-050-04 (documents) at the
same `/api/files/:id/download`, so splitting the store would mean two of everything
underneath one endpoint. `origin` is what FR-050-06 ("exclude files whose block was
deleted") and FR-061-01 will filter on. It is typed as a union with one member today —
widened when documents become the second.

- **Done**: a file round-trips; metadata survives a restart; two concurrent uploads both
  appear.

## Milestone 2 — upload, and two ways to serve

- **What**: `POST /api/chat/files`, `GET /api/files/:id/preview`, `GET /api/files/:id/download`.
- **Files**: `app/api/chat/files/route.ts`, `app/api/files/[id]/preview/route.ts`,
  `app/api/files/[id]/download/route.ts`.
- **Reuse**: the session gate from milestone 0 — an upload is attributed, so it needs the
  same check.

### The serving rule, and why it is two endpoints

Hosting user bytes on our own origin has one serious failure mode: **a file the browser
treats as active content.** An uploaded `.html` echoed back as `text/html` executes *in our
origin*, where the session cookie lives. `X-Content-Type-Options: nosniff` does not help —
it stops sniffing, not an explicit type.

Blocking extensions at upload does not fix it: `.exe` is harmless at rest, `.html` renamed
to `.txt` is not caught, and a blacklist has to stay right forever. The rule belongs where
it is decidable — **at serving time, from server-held state**. That much is
[wafflebase's](https://github.com/wafflebase/wafflebase) `generic-file-upload.md`, which
hit this first.

Two endpoints rather than one, so neither has to branch on a stored value:

| | serves | `Content-Type` | `Content-Disposition` |
| --- | --- | --- | --- |
| `preview` | **only** `image/png\|jpeg\|gif\|webp` | the stored type | `inline` |
| `download` | anything | `application/octet-stream`, always | `attachment` |

`preview` refuses everything it cannot prove is safe; `download` is safe unconditionally.
Neither reads a stored string and decides to trust it. `filename*=UTF-8''…` is
percent-encoded with CR/LF stripped, so a crafted name cannot inject a header.

- **Done**: an image uploads and renders through `preview`; an `.html` upload is refused by
  `preview` and downloads as an opaque attachment; an upload without a session is 401.

## Milestone 3 — attachments on a message

- **What**: `ChatMessage` carries an optional attachment; sending one broadcasts it like
  any other message.
- **Files**: `lib/chat/types.ts`, `lib/chat/chat-service.ts` (+ tests),
  `app/api/chat/route.ts`.

```ts
attachment?: { fileId: string; fileName: string; fileType: string; size: number };
```

**Deliberately the same four fields as `FileBlock`** in `lib/blocks/types.ts`. A file
attached to a message and a file embedded in a document are the same thing seen from two
places, and FR-060-03's document/block links are the next attachment kind — sharing the
vocabulary now is what lets them join as a sibling rather than a special case.

Optional rather than a second message type: FR-060-04 says the message *and* its attachment
info travel together, and UC-060 step 1 has the user typing text *or* attaching a file, so
one message with an optional attachment matches the requirement more closely than two
shapes.

- **Done**: a message with an attachment round-trips through `GET /api/chat` and arrives
  over the socket within a second (NFR-PER-004).

## Milestone 4 — the chat UI

- **What**: attaching, and seeing what someone else attached.
- **Files**: the chat panel components.

- Attach by button, **drag-and-drop, and paste** — a screenshot pasted straight in is the
  common case this feature is really for.
- Images render inline through `preview`; everything else is a card (icon, name, size)
  linking to `download`.
- Upload failure is surfaced with a retry, per UC-060's E1-1 — which asks for a resend
  button, not just an error.

- **Done**: see Acceptance.

## Acceptance

- [ ] `pnpm lint`, `pnpm test` and `pnpm build` pass.
- [ ] Posting a chat message without a session is refused, and `sender` is the session's
      nickname regardless of what the body says.
- [ ] An image sent from one browser appears inline in another's chat, without a reload.
- [ ] A non-image appears as a card and downloads with its original name.
- [ ] An uploaded `.html` cannot be made to render on our origin — `preview` refuses it and
      `download` sends it as an attachment.
- [ ] A file with a name like `../../etc/passwd` is stored and served without escaping
      `.data/files/`.
- [ ] Attachments survive `docker compose down && up`.
- [ ] An upload larger than the cap is refused with a message the sender can act on, not a
      500.

## Cut

Named so nobody re-adds them by accident.

- **Deleting an attachment.** No FR covers it, and it raises a question this task should
  not answer alone: whether removing a file removes the message with it.
- **Virus scanning, quotas, per-user limits.** Nothing in the SRS asks, and a LAN
  workspace of eight has a social answer already.
- **Resumable or chunked upload.** One request per file. A LAN and a 25 MB cap.
- **Sharing bytes with Yorkie.** Bytes never enter a CRDT — `api.md` §1 marks both file
  endpoints as surviving a move to chat version B for exactly this reason. This work is not
  discarded if chat later moves onto Yorkie.

## Cross-cutting

- **Requirements**: FR-060-02 (attach), FR-060-04/05 (attachment info delivered and
  stored), UC-060 E1-1 (resend). Milestone 0 closes the gap under FR-060-01 that
  `chat.md` recorded and left.
- **Roadmap**: `ROADMAP.md` Phase 4. Pulled forward the same way the Yorkie auth webhook
  was — not because the phase is wrong, but because the thing it depends on is being built
  now and retrofitting is worse.
- **Docs that go stale**: `api.md` §1's chat table marks these endpoints unbuilt;
  `chat.md`'s "Open questions" names attachments as not-yet-designed and `sender` as
  client-supplied. All three are edited at the end, not the start.
- **Groundwork for**: UC-061's drawer, which is a query over `files.json` filtered by
  `origin`, and FR-022-13/14's document file blocks, which become a second `origin`.

## Review

Filled in at the end.
