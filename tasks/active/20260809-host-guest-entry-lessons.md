# Host / Guest entry — lessons

**Created**: 2026-08-09

## What surprised us

- **`request.url` in the standalone server is built from `HOSTNAME`, not the `Host` header.** With
  `HOSTNAME=0.0.0.0` in the container, `NextResponse.redirect(new URL("/", request.url))` sent a
  `Location: http://0.0.0.0:3000/` — a different origin, so the browser dropped the cookie that same
  response had just set. It worked under `next start` and failed in the image, which is the worst
  shape a bug can have. Fixed by returning a relative `Location: /`, which the browser resolves
  against the URL it actually asked for. **Verify auth flows against the container, not `pnpm dev`.**
- **Docker Compose passes `${HOST_LAN_IP:-}` through as an empty string**, not as an unset variable.
  `process.env.HOST_LAN_IP ?? fallback` therefore keeps the empty string and printed
  `Guest: http://:3000`. `||` is the right operator here; `??` is not. There is now a test for it.
- **`instrumentation.ts` `register()` does run at boot in the standalone server**, with no request
  needed — but it lands a few seconds *after* Next prints `✓ Ready`, so a short `sleep` in a test
  script sees an empty log and looks like it never ran. It did.
- **`output: "standalone"` makes `next start` print a warning** telling you to use
  `node .next/standalone/server.js`. It still works, so `pnpm start` was left alone — but the
  production path is the image, and the warning is Next being right about that.
- A container genuinely cannot see the LAN address in bridge mode: all it has is its own
  172.16/12 address on the Docker network. There is no clever detection to write — the honest
  answer is to say so and take `HOST_LAN_IP`. On WSL2 the machine's own `eth1` is *also* 172.x, so
  the same rule holds there for a different reason.

## What we would do differently

- Test the Docker path first, not last. Two of the three bugs above only exist inside the container,
  and both were found in the last 20% of the work.
- The `172.16.0.0/12`-is-Docker heuristic is a guess that a campus LAN could legitimately break. It
  ranks those addresses last rather than dropping them, and `HOST_LAN_IP` overrides everything — but
  if someone reports "the guest URL is wrong on our network", that heuristic is the first suspect.

## Worth extracting

- **A run/verify section in `AGENTS.md`.** The Yorkie spike flagged this and it bit again: nothing
  tells an agent that "it builds" is not the same as "it works in the image". Suggested wording:
  *changes to server startup, auth, or networking are verified with `docker compose up --build`, not
  `pnpm dev`.*
- **Tests**: `*.test.mts` + `node --test` (`pnpm test`), stdlib only. First test in the repo. Worth
  confirming as the convention in the still-missing `docs/` test-strategy doc before it spreads by
  accident.
- `docs/` has no code-conventions doc even though `AGENTS.md` §2 and §4 both route to one.
