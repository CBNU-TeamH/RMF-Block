# Chat service — Version A, text slice — lessons

**Created**: 2026-08-12

## What surprised us

- Started milestone 1 (`lib/chat/types.ts`, `app/api/chat/route.ts`) before registering this task
  doc or writing `docs/design/chat.md` — went straight from an approved plan into Build, skipping
  the SDD workflow's Task step. Caught only because it was asked about directly, not because the
  process itself flagged it. Both docs were written retroactively, matching what was already
  decided rather than changing course.
- Confirming "does Next 16.2.12 support WebSocket in Route Handlers" by grepping the actually
  installed `next/dist` (via a throwaway `docker build --target deps` image, since this repo has
  no local `node_modules`) was more reliable than trusting general Next.js knowledge — the feature
  exists as an upstream RFC discussion, which a plausible-sounding but wrong answer could easily
  have missed.
- `next build`'s Turbopack resolver did **not** guess the `.mts` extension on a bare `@/server/ws-hub`
  path-alias import, even though `tsconfig.json`'s `allowImportingTsExtensions` and bundler
  resolution made it seem like it should — had to spell out `.mts` explicitly. Only caught by
  actually running `pnpm build`, not by reasoning about it.
- `NextCustomServer.getUpgradeHandler()` is *not* lazy the way `getRequestHandler()` is — it reads
  `this.server` synchronously, which throws until `prepare()` resolves. Found by reading the
  installed `next/dist/server/next.js` source directly after the first run threw at startup;
  general docs/community knowledge doesn't cover this custom-server-specific ordering requirement.
- The permission bug (root-owned `/app`, `node` user, `.data/` write fails) was invisible from the
  API response alone — `route.ts`'s catch block returned a generic 500 with no server-side log.
  Had to add `console.error` in the catch to see the real `EACCES` in container logs. Worth
  remembering: **an empty/generic error message in a catch block is itself a debugging cost** —
  pays for itself the very first time something unexpected fails in a container.
- `pnpm dev` locally (via a `node --version` mismatch — host defaults to Node 20 via nvm, `.mts`
  native execution needs 22.6+) silently can't even run `server/watcher.mts`-style files; had to
  `nvm install 24` to get a fast local iteration loop before falling back to the much slower
  `docker compose up --build` cycle for final verification.
- Writing unit tests for `chat-service.ts`/`chat-repository.ts` (run via `node --test`, i.e. Node's
  native loader) surfaced that both used TS *parameter properties*
  (`constructor(private readonly x: T)`) — valid, and silently fine, when compiled by Next's real
  compiler, but Node's strip-only type stripping explicitly refuses them
  (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`) because turning that shorthand into `this.x = x` requires
  code generation, not just erasing type annotations. Neither `pnpm build` nor `pnpm dev` ever
  exercised this path, so it was invisible until the first test file tried to import the class
  directly. Fixed by spelling out the field + constructor assignment in both classes.

## What we would do differently

- Write the design doc and register the task doc pair *before* the first implementation file, even
  when a plan was already approved through Claude Code's own plan-mode flow — that approval isn't
  a substitute for `tasks/active/`, which is what a future PR actually links to.
- Run the real `docker compose up --build` verification pass earlier, per file, rather than only at
  the very end — three of the four bugs above (import extension, upgrade-handler ordering, root
  permissions) would have surfaced one at a time, each easier to isolate, instead of stacked
  together at the final check.

## Worth extracting

- When a plan gets approved via plan mode (or any other ad-hoc planning flow) for a task inside
  this repo, create the `tasks/active/` todo+lessons pair as the *first* file-writing action, not
  an afterthought — worth a line in `AGENTS.md` §2's workflow table if this recurs.
- Any Dockerfile that adds `USER node` needs an explicit `chown` step for every directory the app
  writes to at runtime (not just build-time COPY targets) — worth a line in the Dockerfile's own
  header comment, or in `AGENTS.md`, so the next runtime-writable path doesn't rediscover this the
  same way.
- Route handlers should never return a generic error message from a `catch` without also logging
  the real error server-side first — otherwise a container-only bug (like a permissions issue) is
  undiagnosable from the HTTP response alone.
- **Don't use TS parameter properties in any class that a `.test.mts` file (or `server/*.mts`) will
  import directly** — Node's native type stripping can't compile them. Spell out the field +
  constructor assignment instead. Worth a line in `AGENTS.md` or wherever code conventions end up
  documented, since this bites any class shared between Next-bundled code and Node-native code.
- A CodeRabbit pass on the PR caught two real gaps our own manual verification didn't: `list()`
  bypasses the `append()` queue entirely, so a concurrent read during a `writeFile()` truncate could
  observe a partial file — fixed with write-to-temp + `rename()` (atomic on the same filesystem).
  And `readAll()`'s blanket `.catch(() => null)` treated *any* read failure (not just "file missing")
  as an empty store, which meant a transient permission/I/O error could make `writeAppend()` silently
  overwrite real history with just the new message — fixed to re-throw everything except `ENOENT`.
  Both are the same root habit as the `route.ts` catch-block issue found earlier in this task:
  **swallowing an error and substituting a plausible-looking default is the failure mode to watch
  for in this codebase**, not just "forgetting to catch."
