# Testing strategy

- **Status**: Baseline — four layers (including route handlers), the regression/boundary rule,
  and the Vitest worker-count remedy. Component-test, server-component, and route-handler tracks
  are scoped here but not yet built — see [issue #66](https://github.com/CBNU-TeamH/RMF-Block/issues/66).
- **Owns**: none — this is process/strategy, not a module's design rationale. The four layers
  below name which existing design doc still owns *why* each module behaves the way it does; this
  document only says *where a new test for it belongs*.
- **Related**: [issue #66](https://github.com/CBNU-TeamH/RMF-Block/issues/66) (the measured
  layer/line-count breakdown lives there, not duplicated here since it will drift);
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

## The four layers

| Layer | A test here answers | How | Status |
| --- | --- | --- | --- |
| `lib/` + `server/` — pure logic | Does the logic behave correctly in isolation? | Vitest, `environment: "node"`, `node:assert/strict` | In place |
| `app/` client components (`"use client"`) | Did the right thing render, and does it react correctly to focus, event order, and async completion? | Vitest + `@testing-library/react` / `@testing-library/user-event`, opt into a DOM with `// @vitest-environment happy-dom` | Not started |
| `app/` server components — async leaves | Does the server-only gate, redirect, or lookup run correctly before anything reaches the client? | `render(await Page(props))` with `next/headers`/`next/navigation` mocked | Not started |
| `app/api/**/route.ts` — route handlers | Does the auth gate reject before touching data, and does an error map to the right status code? | Call the exported `GET`/`POST`/etc. directly with a constructed `Request` | Not started |

### `lib/` + `server/`

No DOM, no framework — `describe`/`it`/`assert.strict`. This is where the large majority of the
codebase's actual behavior lives, and it's the cheapest layer to test by a wide margin, which is
why it already has the most tests.

### `app/` client components

The motivating cases are the three bugs [#39](https://github.com/CBNU-TeamH/RMF-Block/issues/39)
lists, and all three are the same shape: **"where did focus go," "in what order did the events
arrive," and "what happened to the in-flight request during unmount."** None of the three is "what
is in the DOM" — a `querySelector` assertion would not have caught any of them. That's the actual
case for `@testing-library/user-event` over a lighter DOM-inspection approach: the bugs that
motivated this layer are about interaction sequencing, not markup.

Every `"use client"` file is a candidate. A new component test is required whenever a fix lands
for a bug of this shape — not proactively for every component that happens to exist.

### `app/` server components — async leaves

All of this repo's async server components are **leaves**: they `await` only `cookies()` or
`params`, then return a client component. That's why `render(await Page(props))` works at all —
Next's own guidance against testing async Server Components with Vitest is about *nested* async
components, streaming, and RSC serialization, none of which apply to a leaf.

Two tiers, in order:

- **Tier 1** — cover the leaves as they stand today, with `next/headers`/`next/navigation` mocked.
  The priority case is the **FR-020-03/04 auth gate**: if it breaks, the whole workspace opens
  to anyone. Also in scope at this tier: the redirect when a session already exists, `notFound`
  for an unknown document id, and the document↔member join returning a null `creator` when a
  member was removed — the last of which has a comment explaining the case today and nothing
  verifying it.
- **Tier 2** — extract the gate and join logic into `lib/` so the components become shells. This
  repo's own lessons already state the rule this tier acts on: *geometry belongs outside the
  component.* Tier 1 is the safety net that makes this refactor low-risk, not the end state.

What stays out of both tiers, and stays with the `container smoke test` instead: RSC
serialization, `redirect()` actually throwing, layout↔page composition, hydration. Closing that
gap is tracked separately in [#61](https://github.com/CBNU-TeamH/RMF-Block/issues/61), not here.

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
edit. The same file also carries an already-fixed, currently unguarded bug, named in its own
comment:

```ts
// `null`, a bare number, a string — all parse as valid JSON, so `.json()`
// does not throw and the property read below would, outside the catch
// above. That turned a malformed request into a 500 instead of the 400 it
// is.
```

That is the exact "selection hole" shape #56/#57 already established, one layer over: a fix
landed, and nothing guards it from regressing.

**Required per handler**: an unauthenticated request is rejected before any data access, and an
invalid body maps to 400, not 500. The handler's business logic — `createDocument`, `readDocuments`,
and the like — is already `lib/`'s job and already tested there; a route-handler test is not the
place to re-test it.

## Vitest worker count — symptom and remedy

This is a different failure mode from `vitest.config.mts`'s `pool: "forks"` setting, which exists
for `tmpdir()`/`process.env` isolation between test files — see that file's own comment for why.
Worker *count* is about speed, not isolation, and it fails differently: **if a run times out,
suspect the worker count first.** Vitest's default sizes the pool at 50% of available cores, which
floors to 1 on a low-core machine and serializes every file into one process. Check with
`--max-workers=2` before adding or restructuring tests to chase a timeout — measured 2026-09-02.
