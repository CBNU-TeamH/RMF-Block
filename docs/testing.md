# Testing strategy

- **Status**: All five layers landed; the E2E layer is not a required check yet. Server-component Tier 2 (extract gate/join logic into
  `lib/`) is tracked in [issue #112](https://github.com/CBNU-TeamH/RMF-Block/issues/112).
- **Owns**: none — this is process/strategy, not a module's design rationale. The five layers
  below name which existing design doc still owns *why* each module behaves the way it does; this
  document only says *where a new test for it belongs*.
- **Related**: [issue #66](https://github.com/CBNU-TeamH/RMF-Block/issues/66) (closed — the
  measured layer/line-count breakdown that motivated this doc lives there); [issue
  #61](https://github.com/CBNU-TeamH/RMF-Block/issues/61) (the E2E layer's trigger); [issue
  #112](https://github.com/CBNU-TeamH/RMF-Block/issues/112) (Tier 2, still open);
  [ADR-004](adr/004-test-runner-migration.md) (why Vitest, why `pool: "forks"`, why happy-dom);
  [`docs/conventions.md`](conventions.md) (the Node type-stripping constraint `server/index.mts`
  and every `lib/`/`server/` test run under)

## Scope

Where a new test belongs, and what a bug fix or a limit owes the suite — not a coverage target,
and not the measured breakdown of what's tested today (that lives in #66, and would go stale here
the moment it's quoted).

## The rule

**Every bug fix gets a regression test at the layer the bug lives in. Every limit gets a test at
exactly that value** — not comfortably inside or outside it.

This is the answer to a pattern this codebase has already hit twice: [#56](https://github.com/CBNU-TeamH/RMF-Block/issues/56)
and [#57](https://github.com/CBNU-TeamH/RMF-Block/issues/57) both happened in files that *already
had tests* (`serving.test.mts`, `upload.test.mts`). The missing thing was never a test file — it
was a boundary value inside one. A layer having tests at all says nothing about whether the one
value that mattered was checked.

## Select tests for each change

For every feature or bug fix, record the changed behavior and its success criteria in the task,
then assess the existing tests at each relevant layer before implementation. Revisit that
assessment after the feature works, when the final behavior and affected paths are known.

| Changed behavior | Coverage to assess |
| --- | --- |
| Logic, limits, component interactions, server gates or route responses | The relevant Vitest layer below; extend an existing case when it reaches the behavior, otherwise add a regression or feature case. |
| A user journey after hydration, browser-native input, multiple clients, live updates or outage recovery | Playwright in `e2e/`; cover the observable result through the real browser and stack. A mocked component/route test alone cannot prove it. |
| Container startup, printed LAN/bootstrap addresses, cookie/redirect wiring, auth or service networking | The container smoke steps in [CI](../.github/workflows/ci.yml); extend their HTTP/startup checks when the changed contract is missing. Use browser E2E as well when hydration or interaction is part of that contract. |

Choose the cheapest layer that proves each result. E2E and smoke are assessed separately;
running an unchanged suite is not evidence that it covers a new behavior. Reuse or update an
existing test if it already reaches the path; add a case for a missing path. If a layer needs no
change, name the existing test that covers the result or explain why that layer cannot add
useful evidence. Documentation-only changes can say there is no runtime behavior change.

Before opening the PR, include all required test additions/updates **in the same PR as the
feature or fix** and run the relevant checks against the final implementation. Record test
paths, commands, observed outcomes and any environment gaps in the task and PR. An unavailable
LAN device can leave a measurement gap, but it does not defer writing an automated test that
can run on the disposable stack. File unrelated defects separately and link them; report their
failures without silently skipping them. The PR records smoke and E2E results separately,
including when CI keeps E2E non-blocking.

## The five layers

| Layer | A test here answers | How | Status |
| --- | --- | --- | --- |
| `lib/` + `server/` — pure logic | Does the logic behave correctly in isolation? | Vitest, `environment: "node"`, `node:assert/strict` | In place |
| `app/` client components (`"use client"`) | Did the right thing render, and does it react correctly to focus, event order, and async completion? | Vitest + `@testing-library/react` / `@testing-library/user-event`, opt into a DOM with `// @vitest-environment happy-dom` | In place |
| `app/` server components — async leaves | Does the server-only gate, redirect, or lookup run correctly before anything reaches the client? | Call `await Page(props)` directly with `next/headers`/`next/navigation` mocked; assert on the thrown redirect/`notFound`, or on the returned element's props | Tier 1 in place; Tier 2 in #112 |
| `app/api/**/route.ts` — route handlers | Does the auth gate reject before touching data, and does an error map to the right status code? | Call the exported `GET`/`POST`/etc. directly with a constructed `Request` | In place |
| E2E — a real browser against the running stack (`e2e/`) | Does it still work after hydration, between two clients through Yorkie, and through a real IME composition? | Playwright, Chromium, `pnpm e2e:isolated` or `pnpm e2e` against a disposable running container | In place; a non-blocking step of CI's `container smoke test` |

### `lib/` + `server/`

No DOM, no framework — `describe`/`it`/`assert.strict`. This is where the large majority of the
codebase's actual behavior lives, and it's the cheapest layer to test by a wide margin, which is
why it already has the most tests.

### `app/` client components

The motivating cases are the three bugs [#39](https://github.com/CBNU-TeamH/RMF-Block/issues/39)
lists, and all three are the same shape: **"where did focus go," "in what order did the events
arrive," and "is a dismiss action blocked while a request it would contradict is still in
flight."** None of the three is "what is in the DOM" — a `querySelector` assertion would not have
caught any of them. That's the actual case for `@testing-library/user-event` over a lighter
DOM-inspection approach: the bugs that motivated this layer are about interaction sequencing, not
markup.

Every `"use client"` file is a candidate. A new component test is required whenever a fix lands
for a bug of this shape — not proactively for every component that happens to exist.

An IME bug belongs in this layer when the bug is in *our* handler order — which of `onInput`,
`onCompositionEnd` and `onKeyDown` runs what, and when. `fireEvent.compositionStart` →
`fireEvent.input` → `fireEvent.compositionEnd` reproduces that in happy-dom (`text-block.test.tsx`:
[#103](https://github.com/CBNU-TeamH/RMF-Block/issues/103)'s query, and
[#52](https://github.com/CBNU-TeamH/RMF-Block/issues/52)'s replayed offsets with a real
`yorkie.Document` behind the block). Only what the browser's IME itself does to the textarea needs
a real browser — the E2E layer below.

### `app/` server components — async leaves

The gate and page components this tier covers are **leaves**: they `await` only `cookies()` or
`params`, then return a client component. (`app/admin/page.tsx` is not one: it also awaits the host
check and an async trash purge, and returns server DOM.) That's why calling `await Page(props)` directly is
enough — Next's own guidance against testing async Server Components with Vitest is about
*nested* async components, streaming, and RSC serialization, none of which apply to a leaf.
`redirect()`/`notFound()` really `throw` in this Next version, so the cases where the gate should
actually fire are `assert.rejects` on that call, no rendering involved at all. The cases that
return normally split two ways: the auth gate holding open (a host cookie or a session present)
is checked by simply awaiting the call without it throwing, and the returned element's `props`
can be checked directly — `render()` from `@testing-library/react` doesn't come up anywhere in
this tier, for either kind of normal return.

Two tiers, in order:

- **Tier 1** — cover the leaves as they stand today, with `next/headers`/`next/navigation` mocked.
  The priority case is the **FR-020-04 auth gate** (`app/(workspace)/layout.tsx`): if it breaks,
  the whole workspace opens to anyone. FR-020-03 is the password *check* itself, done upstream in
  `POST /api/workspace/join` — the layout only enforces 04's absence-of-session flip side. Also in scope at
  this tier: the redirect when a session already exists (checked for both the host-cookie branch
  and the existing-session branch separately), and `notFound` for an unknown
  document id. All of it runs under the default `environment: "node"` (no DOM needed).
- **Tier 2** — extract the gate and join logic into `lib/` so the components become shells. This
  repo's own lessons already state the rule this tier acts on: *geometry belongs outside the
  component.* Tier 1 is the safety net that makes this refactor low-risk, not the end state.

Tier 1 covers the thrown `redirect()`/`notFound()` signals directly, with `assert.rejects`. What
stays out of both tiers, and stays with the `container smoke test` instead: RSC serialization,
layout↔page composition, and hydration — end-to-end concerns a mocked, directly-called component
function can't exercise, and the E2E layer's to take on.

### `app/api/**/route.ts` — route handlers

A Next.js route handler is a plain exported async function. It can be called directly with a
constructed `Request` — no server, no DOM, no `render()` — which makes it roughly as cheap as a
`lib/` test, not as expensive as a component test.

The case for testing this layer at all, grounded in the code rather than assumed: `app/api/documents/route.ts`
inlines its own auth check —

```ts
if (!member && !isHostSecret(jar.get("role")?.value)) {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}
```

`sessionRegistry.resolve` and `isHostSecret` each have their own `lib/` tests already. What no
`lib/` test can see is this route dropping the check, or getting the `&&`/`||` wrong, on the next
edit. The same file also carries a bug that was fixed with a runtime check but has no regression
test guarding it, named in its own comment:

```ts
// `null`, a bare number, a string — all parse as valid JSON, so `.json()`
// does not throw and the property read below would, outside the catch
// above. That turned a malformed request into a 500 instead of the 400 it
// is.
```

The check right below that comment (`typeof body !== "object" || body === null`) is what fixes it
today — the gap is that nothing would fail if a future edit weakened or removed that check. That
is the exact "selection hole" shape #56/#57 already established, one layer over: a fix landed, and
no test guards it from regressing.

**Required per handler**: an unauthenticated request is rejected before any data access — this
applies to every handler, whether or not it parses a body. **For handlers that parse a request
body**, add two more cases: an authenticated request with a malformed body maps to 400, not 500;
and an *un*authenticated request with a malformed body still returns 401, not 400 — the auth check
runs before body parsing is even attempted, so an invalid body never gets far enough to be
validated. The handler's business logic — `createDocument`, `readDocuments`, and the like — is
already `lib/`'s job and already tested there; a route-handler test is not the place to re-test
it.

**Landed**: a handler with an auth gate to test has either its own inline check (`app/api/documents/route.ts`, `app/api/documents/[id]/route.ts`'s
private `requireMember()`, `app/api/auth/yorkie-token/route.ts`'s own variant), or delegates to the shared
`lib/auth/current-member.ts` helper (tested once, at that layer, rather than duplicated per route). `auth/host`, `workspace/join` and `internal/yorkie/auth`
get no gate test — they're credential-issuing or self-authenticating endpoints the rule doesn't
apply to. One thing worth stating plainly: **a gate test needs both directions**, not just "rejects
when everything is falsy" — `&&` and `||` agree when every input is false, so
the "succeeds when one side is true" case is what actually pins the operator down.

### E2E — `e2e/`

For what nothing above can reach: behaviour after hydration, two clients converging through Yorkie,
and a real browser's IME composition. Not for anything a component or route test already covers —
a browser run costs seconds per test against milliseconds.

- **Isolated runs.** `pnpm e2e:isolated` derives a disposable project from the existing Compose
  configuration, builds this checkout, publishes app/Yorkie on `127.0.0.1:3100` / `127.0.0.1:8180`,
  and sets the app's `YORKIE_PORT`. An occupied port fails without stopping its owner. Container
  names, network, volumes and app image are unique; teardown removes only that project's resources.
  Run it three times to check repeatability on independent stacks. Arguments pass through to
  Playwright, e.g. `pnpm e2e:isolated --grep diagnostic`, or `--grep-invert @slow` to skip the
  20-second outage while iterating.
- **Existing stacks.** `E2E_WORKSPACE_PASSWORD=<password> E2E_HOST_SECRET=<startup-secret> pnpm e2e`
  targets an already running container (`pnpm docker:up`). `E2E_BASE_URL` defaults to
  `http://localhost:3000`. Use a disposable stack nobody else is connected to: tests assert exact
  roster counts ("N명 접속 중"), so an open host tab fails them, and they leave members,
  documents, messages and files in app/Yorkie storage. Never reset a shared development volume to clean a test run.
- **What it leaves behind.** Every run adds `e2e-…` members and test documents (plus
  the files and chat lines the chat test uploads) to `.data/` — the `app-data` volume, when the
  stack is the container. Shared-stack runs do not remove them, so clean up once testing is done. Stop the
  stack first: the app holds members in memory and rewrites `members.json` from them. Then match
  by field, since one prefix does not cover them all: members by `nickname` and chat lines by
  `sender` starting `e2e-`; files by `uploadedBy` of an E2E member or a name starting `e2e-`;
  documents by `createdBy` in the E2E members' ids
  (collect those ids before removing the members). A file's bytes are `.data/files/<id>`, apart
  from its row in the files index — delete both. This clears the app's catalogue only: the
  documents' content and history stay in Yorkie's Mongo (`mongo-data`). `docker compose down -v`
  is the complete reset of a disposable test stack, and wipes real members and documents too.
- **Users and setup.** `e2e/fixtures.ts` owns independent contexts/sessions/pages, closes every
  context even on failure; Playwright automatically records those contexts into the failure
  trace archive. A run-specific prefix plus reusable slots limits membership additions within
  that run. Repeated runs on a shared stack still accumulate members. A second tab shares its user's context. API
  joining/document creation prepare data; password admission, takeover, tree actions, chat send
  and attachment upload under test use the UI.
- **Coverage.** Existing sync, Hangul IME and image-preview regressions remain. Tests additionally
  cover guest/host admission, takeover cancel/confirm and third-party isolation, tab deduplication,
  arrival/departure, bidirectional/late/reloaded reads, concurrent same-position insertion and
  disjoint-range edits, split/merge ordering, local undo/redo preserving remote input, eight-user
  block/shared-text convergence, live tree create/rename/move/delete, chat sender attribution and
  remote attachment preview. Recovery holds an activated client offline for 20 seconds while both
  sides edit, then checks convergence and chat backfill/deduplication.
- **Anchors and timing.** Capture block IDs and address `[data-block-id="<id>"] textarea`; inspect
  text and block order from the DOM. Wait on DOM values, roster counts and observed network events,
  never `networkidle` or settling sleeps. Chromium, one worker, no retries; ordinary assertions
  allow 15 seconds, eight-user/recovery cases at most 120 seconds. These are test wait budgets,
  not performance thresholds. The deliberate 20-second outage timer defines the experiment.
- **Network evidence.** `e2e/network.ts` observes Yorkie watch response/termination through CDP and
  browser WebSocket open/close events. It aborts live watch fetches and closes the browser's real sockets during an outage, then verifies
  their termination through CDP/events; Chromium's offline toggle alone can leave existing
  streaming responses and sockets open. New requests remain offline until restoration.
  Concurrent-edit cases sever every client's Yorkie stream while they type, so no edit can see
  another first. The page closes sockets itself (code 4000) rather than losing them (1006); a
  recovery path that tells the two apart would need a server-side cut.
  Initial Yorkie setup and session-notification reconnection are `diagnostic:` tests marked
  `test.fail` against #37: reported as expected failures, so the step stays readable, and failing
  as "unexpected pass" once #37 lands — the cue to drop the mark. Never a skip. An expected
  failure passes whatever throws, so check its error in the report still points at the last
  assertion (the reconnect), not at the setup before it.
- **IME.** A CDP session drives composition with `Input.imeSetComposition` and confirms through
  `Input.insertText`; a third observer verifies delivery while the first user is composing.
- **Artifacts and secrets.** Reports live in `playwright-report`, traces in `test-results`.
  Isolated server logs live in `e2e-artifacts/<project>/server.log` and redact bootstrap secrets
  and the generated password. Host bootstrap tests disable tracing so secret URLs and role
  cookies cannot enter trace archives. The secret is read from the isolated startup log and
  passed in process environment only. Normal guest traces contain test session credentials;
  artifacts belong to the disposable stack.
- **CI.** Expanded tests run after the existing smoke test on its container, with E2E's
  `continue-on-error` policy preserved. CI masks the bootstrap secret and uploads failure traces,
  the HTML report and redacted server logs.
- **Follow-up.** Admin setup/access/password/kick/restart plus integrated user-location navigation
  are tracked in [the admin E2E task](../tasks/active/20261007-admin-e2e-todo.md); admin merged in PR #170, and this coverage remains a separate task. Long-running load, 1-second propagation, 500MB client memory, real LAN
  devices and Firefox/WebKit remain separate from functional correctness.


## Vitest worker count

If a run times out, suspect the worker count first — the reasoning is in `vitest.config.mts`'s comment. Check with `--max-workers=2` before restructuring tests.

## What a local Node version can verify, and what only CI can

A local machine's Node version silently gates what "verified by running" means. Pure-Node checks
(`comment-budget.mjs`, the doc-ownership checker) verify fully on any supported version; anything
touching `next.config.ts`'s dev/prod `distDir` split only fully verifies under the `NODE_ENV` CI actually
runs. Name the gap when a task hits it, rather than assuming a green local run covers what CI covers.
