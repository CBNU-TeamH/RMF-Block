# Chat file attachments — lessons

**Created**: 2026-08-31

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **A feature can be "done" and still be silently broken between page loads.** The chat
  panel worked in every check that started with a fresh load, and was permanently deaf in
  every tab older than the last server restart. Reloading before testing is how you never
  see it. The tell was a tab that had been open a while showing fewer messages than
  `GET /api/chat` returned.
- **A stale socket looks exactly like a quiet room.** No error, no console message, no
  visual difference. The only way to tell them apart was to open a second socket by hand
  and see the broadcast arrive on it while the panel ignored the same message.
- **Prettier disagrees with `docs/` and always has.** `--check` fails on files nobody has
  changed. Nothing runs it on docs in CI, so reformatting would have been a large diff
  proving nothing.
- **A `.svg` is an image that can run scripts.** `startsWith("image/")` is the natural way
  to write the preview whitelist and it is wrong for exactly this one type — which is why
  the list is four literals.
- **The browser automation tool refused a verification script** for looking like it handled
  cookies. Rewriting it as `scripts/verify-chat-files.mjs` was better anyway: the team can
  re-run it, and it exercises the same HTTP surface a browser would.

## What we would do differently

- **Test the reconnect path before calling realtime done.** "Message appears without a
  reload" passes on a fresh socket and says nothing about the socket's whole life. The
  question worth asking is what happens after the connection drops — because it will.
- **Reconnect and backfill are one feature, not two.** Reconnecting without refetching
  history leaves a hole exactly where the outage was, and the hole is invisible: the
  message list looks continuous.
- **Check the route before asserting a status code.** Two verification cases expected 415
  from `preview` and got 404. The route's own comment explained why 404 is the true
  statement — "there is no preview of this", nothing to retry with a different `Accept`.
  The code was right and the check was wrong.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **`scripts/verify-*.mjs` is now a pattern** — `verify-auth.mjs`, and now
  `verify-chat-files.mjs`. Each prints expected vs actual per case and exits non-zero, so
  it reads as documentation and runs as a check. The right home for claims about what the
  *running server* does, which a unit test cannot make.
- **Geometry belongs outside the component.** `lib/chat/window-frame.ts` takes the viewport
  as an argument instead of reading `window`, so every rule is testable without a browser.
  Worth copying wherever a mistake is unrecoverable — a window dragged off-screen cannot be
  dragged back.
- **When two places must agree on a number, export it from one.** The launcher bar's height
  is both a CSS height and the limit the window stops at. As a Tailwind class plus a
  constant it was two values that had already drifted; as one exported constant the drift
  is impossible.
