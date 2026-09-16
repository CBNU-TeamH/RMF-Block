# Connected-user list — lessons

**Created**: 2026-08-25

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **The presence problem was already solved, one layer down.** The first cut of this task was a
  hand-rolled registry on the WS hub, with a socket refcount per session so two browser tabs would
  not drop a member when one closed. All of it was thrown away: `client.attach()` and
  `doc.getPresences()` do the same job, and Yorkie's `defer unwatchDoc(...)` on the
  `WatchDocument` stream handles the disconnect case that the refcount existed to approximate.
  Reach for the SDK before writing the bookkeeping.
- **`yorkie.Channel` looks like the right tool and is not.** It is presence-shaped — join a room,
  get a live count — but `getSessionCount()` returns a number and the channel carries no per-client
  data. FR-020-07 needs a nickname and a color tag, so it has to be a document with presence.
- **One member really can hold several Yorkie clients.** Verified rather than assumed: two clients
  attached under the same member id show up as two entries in `getPresences()`, so the dedupe in
  `readRoster()` is load-bearing, not defensive. Confirmed twice — from a Node script and from two
  browser tabs, which showed `(1)`.
- **`getPresences()` includes yourself**, unlike `getOthersPresences()`. That is what makes the
  roster a 접속자 목록 rather than an "everyone else" list, so no local entry has to be spliced in.

## What we would do differently

- Read the SDK's own `dist/presence.html` example earlier. It is what surfaced `yorkie.Channel`,
  and the shape of the attach/detach lifecycle, faster than the type definitions did.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **`docker compose` on this machine cannot run our own compose file.** `docker-compose.yml` uses
  `attach: false` on the mongo service, which needs Compose ≥ 2.20; the machine used here has
  2.13.0, and `pnpm docker:up` fails with `services.mongo Additional property attach is not
  allowed`. Either the compose file needs a minimum-version note in `README.md` or the property
  needs dropping — a teammate on an older Docker Desktop hits a confusing error, not a clear one.
- **`pnpm build` then `pnpm dev` fails until `.next` is cleared.** The production build leaves a
  `.next` that the dev server cannot use: `Could not parse module '[project]/instrumentation.ts',
  file not found`, for a file that plainly exists. `rm -rf .next` fixes it. Worth a line in
  `README.md` — the error names the wrong cause and costs time.
- **Verifying a browser-only feature does not need two browser profiles.** One real tab plus a Node
  script holding a second Yorkie client is enough to prove a live roster update, and it is
  scriptable. Cookies are shared across tabs in one profile, so two tabs cannot be two users.
