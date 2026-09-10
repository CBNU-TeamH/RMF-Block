# ADR-004: Test runner migration — `node --test` to Vitest

- **Status**: Accepted
- **Date**: 2026-09-09
- **Related**: [ADR-003](003-stack-choices.md) (Decision 4), issue #39, issue #66 (Phase 2 of #67),
  `tasks/archive/2026/09/20260909-vitest-runner-migration-todo.md`
- **Supersedes**: [ADR-003](003-stack-choices.md) — Decision 4 only. Decisions 1, 2, 3, and 5
  stand unchanged.

## Context

ADR-003 §4 chose `node --test` by default and named the eventual gap plainly: "Every test we have
is pure logic under `lib/` and `server/`. Nothing renders." It tracked closing that gap as
[issue #39](https://github.com/CBNU-TeamH/RMF-Block/issues/39), named "Vitest and Testing Library"
as the likely shape, and was explicit about the scope: **"an addition, not a migration"** — the 88
passing `node --test` tests had nothing to gain from being rewritten, so the plan was to run two
runners side by side, `node --test` for logic and a second one for anything that renders.

That is not what happened, and the reason is not a change of taste. `.githooks/pre-push`'s own
header already carried the real trigger before this ADR existed:

> measured 2026-09-04: bare `node --test` finds 0 tests on local Node 22 (its default test-file
> discovery doesn't pick up `*.test.mts` the way Node 24 does, which is what CI runs)

`node --test`'s test-file discovery is Node-version-dependent, and this repo's own CI and a
contributor's local machine were on different major versions of Node. That is a correctness bug in
the current runner, not a missing feature — running it side by side with a second runner would
have fixed component-testing but left the discovery bug in place for every existing test. Once the
runner itself has to be touched to fix that, "addition" stops being the cheaper plan: maintaining
two test frameworks (two configs, two mental models, two things to keep working under two Node
versions) forever, for tests that migrate with a one-line import swap, is the more expensive
option, not the safer one.

## Decision

### 1. Runner: Vitest, full migration

All 31 `*.test.mts` files move to Vitest. 30 needed only `node:test` → `vitest` on the
`describe`/`it` import line; one (`lib/files/file-repository.test.mts`) also renamed `after` to
`afterAll`. No file used `t.mock`, a `TestContext` param, snapshots, or `.only`/`.skip`/`.todo`, so
nothing needed rewriting beyond the import.

**Alternatives considered**

- **Jest** — the other mainstream option. Rejected: still needs jsdom/happy-dom for anything that
  renders, so it buys nothing over Vitest here, and it is the heavier tool with a slower cold
  start for a project this size.
- **Keep `node --test`, add a second runner alongside it** — ADR-003's original plan. Rejected:
  it does not fix the Node-version-dependent discovery bug that is the actual reason this is being
  touched at all, and it commits the project to two test configurations indefinitely for a
  one-line-per-file migration cost.

### 2. Test pool: `"forks"`

The existing suite writes to `tmpdir()` and mutates `process.env` in several places. Vitest's
default worker pool shares a process across files in the same worker; that would leak state
between tests that were previously isolated by `node --test`'s per-file process model. `"forks"`
keeps each test file in its own process, matching the isolation the suite already assumed.

### 3. DOM environment: happy-dom, not jsdom

jsdom was the first candidate (matches the Next.js testing guide's default), gated on a throwaway
smoke test: `dialog.showModal()`, needed by `document-list.tsx` and `join-form.tsx`. jsdom 30.0.1
does not implement `HTMLDialogElement.prototype.showModal()` — the smoke test failed with
`TypeError: dialog.showModal is not a function`. The identical test passed unchanged under
happy-dom 20.14.0. jsdom was removed from `devDependencies`; happy-dom is the DOM environment for
every test file, opted into per-file with a first-line `// @vitest-environment happy-dom` pragma
rather than `environmentMatchGlobs` in config — that config key's name has changed between Vitest
versions, and the pragma has not.

### 4. Local Node floor: 24.15.0+, settled on latest LTS (24.21.0)

Independent of decision 3 above, but surfaced by installing it: jsdom's `engines.node` was
`^22.22.2 || ^24.15.0 || >=26.0.0`, and this machine's active Node (24.1.0, installed via nvm) sat
below the 24.x floor jsdom needed. `pnpm`'s `engine-strict` is off, so the mismatch installed
silently — no version was actually broken by this ADR's decisions, since jsdom was dropped for
decision 3, but the gap is worth recording because it would have resurfaced with the next
DOM-dependent dependency. CI (`node-version: 24` in `.github/workflows/ci.yml`, unpinned to a
patch) and the Dockerfile (`node:24-alpine`) already float to the latest 24.x at every run and
build; only the locally pinned nvm version had gone stale. Bumped to 24.21.0 (the current 24.x
LTS) rather than pinning to the bare 24.15.0 floor, since nothing in the stack asks for an upper
bound.

### 5. `@types/node` bumped to match Vitest 5's peer range

Vitest 5 declares a peer dependency on `@types/node@"^22.0.0 || >=24.0.0"`. The repo had
`@types/node@20.19.43`, which does not satisfy that range — a types-only mismatch, not a runtime
one, but one `pnpm install` was warning about on every run. Bumped to `^24` to match decision 4's
Node floor.

### 6. ESLint flat config — recorded, not decided

`eslint.config.mjs`'s flat-config shape (`defineConfig` + `eslint-config-next/core-web-vitals` +
`eslint-config-next/typescript`) arrived with `create-next-app`
(`444f0dd`, "chore: scaffold Next.js app and migrate SSOT docs"). No flat-vs-legacy-config
comparison exists anywhere in this repo's history — it is the scaffold default, kept because
nothing has asked for anything else. The ignore list has evolved since (`docs/ui/**` added after
`pnpm lint` was found walking 39 wireframe-asset errors in #35; `.next-dev/**` added after the
split-`distDir` change produced 508 lint errors in generated dev bundles that CI never saw), but
those are fixes to what the config excludes, not a decision about the config's shape.

### 7. `ws` / `@types/ws` — recorded, not decided

ADR-001 and ADR-003 both explain *why a WebSocket layer exists at all*: Next has no WebSocket
route handler, so `server/index.mts` is a custom server that owns the upgrade. Neither, nor
anything else in this repo's history, explains why `ws` specifically over an alternative (e.g.
socket.io, which adds its own reconnection/room semantics this project doesn't use). `ws` was
added directly with the custom server in `e3cf842` ("feat: add chat REST + WebSocket service
(text-only slice)") with no comparison on record. It is the smaller, more literal wrapper around
the WebSocket protocol Node already needs a library for, which fits decision 2's "as little
structure as the problem needs" — but that is this ADR's inference, not a decision anyone is on
record making at the time.

### 8. Next / React / React-DOM / TypeScript version pins — recorded, not decided

`next@16.2.12`, `react@19.2.4`, `react-dom@19.2.4`, and `typescript@^5` were all set in the same
scaffold commit (`444f0dd`). No commit or doc discusses why these particular versions over
adjacent ones. ADR-003 already calls the App-Router-vs-SPA framework choice itself "reconstructed
after the fact"; this decision just extends that same admission to the exact version numbers —
they are scaffold defaults, kept because they still work, not evaluated against alternatives.

## Consequences

- **One test runner, one config, one Node-version story.** The discovery bug that forced this
  migration cannot recur, because Vitest's file discovery is not Node-version-dependent the way
  `node --test`'s was.
- **happy-dom, not jsdom, is now the DOM environment this project's tests run under.** Any future
  test relying on a jsdom-specific behavior happy-dom does not emulate needs the same
  empirical check this ADR ran, not an assumption that "jsdom is the default so it must work."
- **Decisions 6–8 close no open question** — they document that ESLint's config shape, the `ws`
  package choice, and the framework/language version pins were never deliberated, so a future
  contributor asking "why this and not X" gets an honest "nobody compared, it still works" instead
  of no answer at all or an invented one.
- **`docs/conventions.md`'s "Node type-stripping constraint" section loses its `node --test`
  paragraph** (per that section's own forward-pointer) — its production-side reasoning
  (`server/index.mts` run directly by `node`) is unaffected by this ADR.

## What this ADR does not claim

Decisions 1–5 are real: a specific bug was measured, a specific alternative was tried and failed
a specific test, and specific version numbers were chosen against specific constraints. Decisions
6, 7, and 8 are not decisions in that sense — they are this ADR's honest record that no comparison
exists for ESLint's flat config, the `ws` package, or the Next/React/TypeScript version pins,
following [ADR-003](003-stack-choices.md)'s own precedent of saying so plainly rather than writing
a plausible-sounding story after the fact. If a teammate remembers an actual reason for any of
those three, theirs is the record and this document should be corrected.
