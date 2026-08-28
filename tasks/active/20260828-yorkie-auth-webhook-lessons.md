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

## What we would do differently

- ...

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- ...
