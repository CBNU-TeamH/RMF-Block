# Gate Yorkie behind the workspace session — lessons

**Created**: 2026-08-28

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **Yorkie caches an auth decision for 10 seconds, and that hid the bug the whole
  verification existed to find.** The first run of the token-rotation test showed a
  rotated token still working and the webhook never being consulted — which looks
  exactly like "the SDK does not refresh". It was the cache
  (`DefaultAuthWebhookCacheTTL`, `server/config.go`). Waiting past it produced the real
  sequence: `allow v1` → `deny v1` → `allow v2`. **Any test of an auth decision has to
  outlast that window or it measures the cache.**

  Then it happened *again*, one test later, after that lesson was already written here:
  four status-code combinations all "passed" because the first allow was cached and the
  rest never reached the webhook. The cheap way out is in the cache key —
  `generateCacheKey(publicKey, body)` hashes the request body, and the body carries the
  token, so **a different token per attempt is a different cache entry.** No waiting.

- **`200 + allowed:false` is not a refusal.** `handleWebhookResponse`
  (`server/rpc/auth/webhook.go`) accepts exactly three pairs — `200`+allowed,
  `401`+refused, `403`+refused — and everything else falls to `default` as
  `ErrInvalidJSONResponse`. Measured: the client is still stopped, but as
  `[internal] status=200, allowed=false … invalid JSON response` rather than
  `[unauthenticated]`. It looks like it works while being the wrong thing: it takes the
  retry path, muddies the logs, and hands the client an error of the wrong kind.
  `401` is also the one branch Yorkie does **not** cache.
- **The SDK hands our webhook's `reason` string to `authTokenInjector`.** The signature
  is `(reason?: string) => Promise<string>`, and the value that arrives is whatever the
  webhook put in `{ allowed: false, reason }`. That makes the refusal reason a real
  channel from server to client, not just a log line.
- **The Admin API needs no client library.** It is connect-protocol, so plain
  `fetch` with `Content-Type: application/json` against
  `/yorkie.v1.AdminService/<Method>` works. The JS SDK ships no admin client, and none
  is needed. The header must carry the `Bearer` scheme — without it the error is
  *invalid authorization header format*, which reads like a malformed token rather than
  a missing prefix.
- **An invalid auth-webhook method name is rejected at configuration time**, not
  silently ignored: `WatchDocuments` (plural) fails the `UpdateProject` call. The valid
  names are in `api/types/auth_webhook.go`, and `WatchDocument` is the singular one.

- **`throw` from `instrumentation.ts` does not stop the server.** Next installs its own
  `unhandledRejection` listener, so the error is logged, `app.prepare()` never rejects,
  and the process keeps running with port 3000 closed — measured, forty-five seconds of
  it. A `try`/`catch` around `prepare()` catches nothing for the same reason. Only
  `process.exit(1)` works. Worth knowing beyond this task: **anything in that hook that
  is meant to be fatal has to exit, not throw.**

- **`localhost` is the one webhook address that is always wrong**, and it fails in a way
  that reads like something else. Everything was refused, valid sessions included, with
  `verify access: send webhook` — which looks like Yorkie misbehaving rather than an
  address pointing at Yorkie's own container. Yorkie stores the URL without testing it,
  so a wrong one registers exactly like a right one, and the mistake only appears later
  in a client's error. Startup now prints the address it registered, which is the cheap
  way to make it visible where someone is already looking.

- **`/bin/sh` in the Yorkie image is dash.** A healthcheck written the short way
  (`CMD-SHELL`, or `docker run --health-cmd 'exec 3<>/dev/tcp/...'`) fails with
  `cannot create /dev/tcp/...: Directory nonexistent` and the container simply never
  turns healthy — no error anywhere except `docker inspect`'s health log. `/dev/tcp` is
  a bash feature, so the check has to spell out `["CMD", "bash", "-c", …]`.

## What we would do differently

- **Write the acceptance criteria against the design, not against a wish.** One of them
  said a browser should recover by itself after the app server restarts. Sessions are in
  memory and a restart is the documented revoke path, so a browser that recovered would
  mean the restart had revoked nothing. It was withdrawn rather than ticked, but it
  should not have been written.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **Verifying against a container makes it easy to run commands in the wrong repository.**
  Reading Yorkie's source meant `cd`-ing into the vendored `yorkie` checkout, and a later
  `gh issue create` picked up *that* repo's remote — an issue meant for this project was
  filed against the upstream open-source one, publicly, and could not be deleted, only
  closed with an apology. `gh` infers the repository from the working directory. **Pass
  `--repo` every time**, or never leave the project directory.
