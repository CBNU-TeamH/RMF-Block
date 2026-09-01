# PDF block and its in-app viewer — lessons

**Created**: 2026-09-01

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **The storage layer needed no change at all.** `document.ts` was written
  exhaustive over all twelve types back when only seven could be created, and
  `readBlocks`/`toStoredBlock` round-tripped a `pdf` block correctly on the first
  try. The note in `create.ts` — *"They stay typed in `types.ts` so a renderer
  must still handle them"* — paid for itself: this task is a renderer plus an
  upload, not a schema change.
- **The browser's PDF viewer is a real feature, not a fallback.** Paging, zoom,
  search, print and a page counter all come from one `<iframe>`. Reaching for
  `pdfjs-dist` first would have been several megabytes and a worker asset spent
  rebuilding what every browser in `docs/SRS-ko.md` §4.2 already ships.
- **The existing block `onDrop` was already the right place for a file drop.** A
  drag from the desktop and a drag of the block handle are the same event with a
  different `dataTransfer`, so "drop a PDF where the pointer is" cost one branch
  and reused `dropsBeforeTarget` unchanged. The one thing it needed was
  `stopPropagation`, or the container's own drop handler ran on the same event.
- **A hand-rolled modal was the wrong instinct.** The first viewer was a fixed
  `<div>` with its own backdrop, Esc listener and `autoFocus`. `join-form.tsx`
  had already worked out that `<dialog>` + `showModal()` is the only way to get
  the backdrop, the focus trap and the inertness of what is behind — and it
  brings Esc with it. Reading the neighbouring file first would have saved
  writing all three by hand.
- **Two clients cannot be two tabs of one browser.** Sessions are one per member
  and the cookie jar is per origin, so a second tab either displaces the first or
  (over `127.0.0.1` instead of `localhost`) trips Next's dev cross-origin block.
  What worked was attaching a **second Yorkie client from Node** with a token
  from `/api/auth/yorkie-token` — see "Worth extracting".
- **`pnpm dev` cannot be reached from another device — and it fails silently.**
  Next's dev server blocks `/_next/*` from any host but `localhost`, so a phone
  at `http://<LAN-IP>:3000` gets the server-rendered HTML and *no client
  JavaScript*. The page looks fine and nothing errors on screen; React never
  hydrates, so the join `<form>` falls back to its native GET and the request
  arrives as `GET /join?nickname=…&password=…` with no login ever attempted. It
  reads exactly like a wrong password. `pnpm build && pnpm start` — how the app
  actually ships — has no such restriction. See "Worth extracting".
- **An `<iframe>` inside a *closed* `<dialog>` still loads its `src`.** Every PDF
  block on the page was fetching its file twice until the dialog's frame was
  made conditional on the open state.

## What we would do differently

- **Check for the missing file once per mount, and it stays wrong until a
  reload.** The block HEADs `preview` to decide between the frame and the "파일을
  찾을 수 없습니다" card. If the file appears later, the card stays until the page
  is reloaded. Fine for the case it exists for (a block from another workspace,
  which never resolves) and wrong for a transient failure. Retrying on an
  `<iframe>` `onError` would be better, but `<iframe>` does not fire one for an
  HTTP error, so it would need the fetch retried on a timer — not worth it until
  someone hits it.
- **`readableSize` is now in two files** (`chat-message.tsx` and `pdf-block.tsx`).
  Restated deliberately — six lines, and nothing depends on the two agreeing —
  but the third caller is the one that should move it into `lib/`.

## What we could not verify

- **Esc closing the full-screen viewer.** It rests on the browser's native
  `<dialog>` dismissal — the same mechanism `join-form.tsx` already depends on —
  and that is not reachable from browser automation: with a modal dialog open,
  a synthetic Escape never arrives as a `keydown` in the page at all (measured:
  a capture-phase listener on `document` recorded nothing), and the dialog's own
  `cancel` never fires either. An explicit key handler was written to cover it
  and then removed, because it could not be tested any better than the native
  path and duplicated it (`AGENTS.md` §3.2). 닫기 and the backdrop click *are*
  verified, so the viewer is never a trap even if Esc were to fail.
- Related and worth knowing: once focus is inside the PDF, Esc belongs to the
  browser's viewer, not to this page. That is why the 닫기 button is not
  decoration.

## Worth extracting

- **A second Yorkie client, from Node, is how to verify realtime work.**
  `/api/auth/yorkie-token` issues a token to anything holding the session cookie,
  and `@yorkie-js/sdk` runs under Node, so ~30 lines gives a genuine peer:
  attach, `doc.subscribe`, print the op paths. It proved both directions here —
  the peer saw `add@$.blocks` / `remove@$.blocks` when the browser inserted and
  deleted, and the browser rendered a block the peer pushed, live. That beats
  two browser windows, which this app's one-session-per-member rule does not
  allow anyway. Worth a script in `scripts/` if the next realtime task wants it.
- **`lib/files/upload.ts` is the shared request guard now.** Any third upload
  endpoint should call `readUpload` rather than restating the content-length and
  size rules — the reasoning for why the declared length is *required* is subtle
  enough that a copy would eventually lose it.
- **Test from another device against `pnpm start`, never `pnpm dev`.** Worth a
  line in `README.md`'s "While developing" block if anyone else loses an hour to
  it. Adding the LAN IP to `allowedDevOrigins` in `next.config.ts` would also
  work, but it hardcodes one machine's address into the repo — if we want that,
  it should read `HOST_LAN_IP` rather than a literal.
- **Verify a file's type from its bytes when the block type depends on it.**
  `looksLikePdf` is five bytes of check and it is what stops a `.docx` renamed
  `.pdf` from becoming a PDF block that renders an error on everyone's screen.
  The image leg of FR-022-14 should do the same with its own magic numbers.
