# Code Conventions

- **Status**: Baseline — five forbidden shapes, the comment rule, and two named constraints.
- **Related**: [`AGENTS.md`](../AGENTS.md) §3 principles 2 and 3 (simplicity first, surgical
  changes), which this document makes checkable; installed via the `code-review` and
  `code-simplifier` plugins in [`skills/README.md`](../skills/README.md).

## Scope

`AGENTS.md` §3 states four principles — think before coding, simplicity first, surgical changes,
goal-driven execution. This document is what "simplicity first" and "surgical changes" look like
when a specific shape of code violates them: not a style guide, but a list of ways code can
**behave correctly and still be shaped wrong.**

That distinction matters because nothing else in this repo's harness catches it. Tests check
behavior. `#40` is the clearest example of the gap: it describes code that passes every test
before and after the fix, and says so directly — *"the seven persistence tests … should pass
unmodified and act as the check on the refactor."* The only thing that can tell the two shapes
apart is a rule a reviewer — human or the `code-review` plugin's CLAUDE.md-compliance and
code-comment-compliance agents — can check against. This document is that rule.

The five shapes below were not chosen. They were derived by classifying every open bug in this
repo (excluding the meta-issue `#39`, which is about the harness itself, not a shape) into
buckets. Five buckets cover 5 of 7 — 71%. The two that don't fit, `#37` (a reconnect path that
was never built) and `#26` (a connection-ordering race), are left out on purpose: a rulebook
that explains every bug prevents none, and a shape-rule for "sometimes things are concurrent" is
not a rule anyone could apply.

## The five forbidden shapes

### S-1 — Mutate first, roll back on failure

**Forbidden**: update in-memory state, then write to disk or over the network, then hand-roll an
undo if the write fails.

**Instead**: compute what the result *would* be, write it, and only touch in-memory state after
the write succeeds. There is nothing to roll back, because nothing was touched before the write
that could succeed could be confirmed.

**Detection signal**: a `catch` block that manually reverses several of the mutations the `try`
block just made; a comment explaining why only some of them are undone.

**Cited by**: [`#40`](https://github.com/CBNU-TeamH/RMF-Block/issues/40) (open). `join()` updates
five maps, then persists; on failure it hand-rolls back four of the five deletes, because the
fifth can never fire — and the issue exists because *that* took a twelve-line comment to explain.
Its own diagnosis: *"The rollback is a consequence of that shape, not something inherent to the
problem."*

### S-2 — Two owners for one piece of state

**Forbidden**: the same fact lives in two places that are supposed to agree, updated by two
different code paths.

**Instead**: name one owner. If a mirror is genuinely unavoidable, route every write through one
function so the mirror can't drift out from under it.

**Detection signal**: the same value read from two different variables, refs, or stores in the
same component or module; a bug report where "the UI shows X but the data is Y."

**Cited by**: [`#59`](https://github.com/CBNU-TeamH/RMF-Block/issues/59) (closed, fixed) —
`TextBlockView`'s DOM value and Yorkie's CRDT state disagreed after a parent-driven split or
merge, because the textarea only refreshed on `remote-change` events, not on local mutations the
parent made on its behalf. [`#52`](https://github.com/CBNU-TeamH/RMF-Block/issues/52) (open) is
the same shape one level deeper: queued remote edits and the local composition buffer are two
owners of "what the text currently is," and replaying one against offsets computed for the other
is what corrupts `lastSyncedRef`.

### S-3 — Swallow an error, substitute a plausible default

**Forbidden**: catch broadly, and return something that looks like a valid empty state instead of
letting the failure surface.

**Instead**: handle the specific failures you actually expect (a missing file, a known error
code), and re-throw everything else.

**Detection signal**: a bare `.catch(() => null)` or `.catch(() => [])` with no check on *what*
failed.

**Cited by**: [`20260812-chat-service-lessons.md`](../tasks/archive/2026/08/20260812-chat-service-lessons.md)
(no open issue — already fixed on discovery). `readAll()`'s blanket `.catch(() => null)` treated
any read failure, not just "file missing," as an empty store — a transient I/O error could have
silently overwritten real history with just the newest message. The lessons entry's own framing:
*"swallowing an error and substituting a plausible-looking default is the failure mode to watch
for in this codebase."*

### S-4 — Hard-code a limit without checking the spec

**Forbidden**: pick a number for a boundary (a size limit, an encoding rule) without checking
what the relevant standard actually says, or testing the exact edge.

**Instead**: cite the clause the limit comes from, and write a test at that exact boundary value
— not just comfortably inside or outside it.

**Detection signal**: a numeric literal with no comment pointing at a spec section; a limit
that's "close enough" to a round number.

**Cited by**: [`#57`](https://github.com/CBNU-TeamH/RMF-Block/issues/57) (open) — an upload
exactly at `MAX_UPLOAD_BYTES` is rejected, because the check compares `Content-Length` (the whole
multipart body, boundary overhead included) against the limit meant for the file's own size.
[`#56`](https://github.com/CBNU-TeamH/RMF-Block/issues/56) (open) — `encodeURIComponent` alone
leaves `'`, `(`, `)`, `*` unescaped, which RFC 8187's `attr-char` for `filename*=` explicitly
excludes; the four characters were never checked against the actual grammar.

### S-5 — Ignore an existing precedent for the same situation

**Forbidden**: solve a problem the codebase has already solved elsewhere, with a new approach
instead of the one already in place.

**Instead**: use the existing path. If it genuinely doesn't fit, say why in one line rather than
silently diverging.

**Detection signal**: two components doing the same kind of state sync in two different ways,
where a code-review pass would ask "why not the way the sibling component does this?"

**Cited by**: [`#59`](https://github.com/CBNU-TeamH/RMF-Block/issues/59) (closed) — the fix's own
pattern already existed in the codebase, in the markdown-shortcut path, which clears its textarea
and its `lastSyncedRef` by hand with a comment explaining why. Split and merge needed the same
mirroring and didn't have it; the issue's shape section calls this out directly: *"The pattern for
fixing it already exists in the codebase, and says so."*

## What may stay as an inline comment

The test: **could a reader derive this from the code itself?** If yes, the comment is restating
what's already legible and should go. If no, it's carrying information the code genuinely can't,
and it earns its place. Five kinds pass:

1. **An external constraint the code can't express.** The SDK `JSON.stringify`s every presence
   value before sending it, so `undefined` doesn't survive the round trip — nothing in the type
   signature says that, so `lib/presence/types.ts` has to. A Yorkie document key only permits
   `a-z A-Z 0-9 - . _ ~` — that's a fact about the library, not about this codebase.
2. **A one-line requirement tag** — `FR-020-06/07`, `UC-021 step 5`. Traceability, not
   explanation.
3. **A deliberate-simplicity marker** — see below.
4. **A cross-reference to the design doc that now owns the rationale.** One line, naming the
   file and what it answers: *"Why presence rides Yorkie rather than the WS hub:
   `docs/design/presence-and-focus.md`."* Not the argument, just where the argument lives.
   Moving rationale out of a file and leaving no trace of where it went makes the next reader
   re-derive it, or re-write it here.
5. **A one-line statement of what an exported symbol is**, where the name alone does not carry
   it. `WORKSPACE_DOC_KEY = "workspace"` does not say it is a document nobody edits, attached to
   only so members can be counted present. One clause. If it needs two sentences, it is
   rationale, and rationale goes to `docs/design/`.

Anything else — "why this design is safe," "what alternative was considered and rejected," "the
history of how this got here" — belongs in `docs/design/`, not in the code. If a file's comments
have grown past what these five kinds explain, that file's rationale has outgrown the code and
needs a design doc to hold it, not a longer comment.

Kinds 4 and 5 were promoted here from `20260905-comment-budget-lessons.md`: both were already in
use — #70 established the cross-reference when it moved this rationale out — and the rulebook not
naming them meant every trim re-argued whether they were allowed.

### Write the comment in as few lines as it takes

Format is not content. A JSDoc block whose prose is one sentence is written on one line:

```ts
/** UC-021 E4a. */
```

not

```ts
/**
 * UC-021's E4a: a name already in use gets a disambiguating suffix rather
 * than being refused — the SRS asks for "겹치지 않는 식별자", not an error.
 */
```

Both point at the same rule. The second spends four lines restating a sentence already in
`docs/SRS-ko.md` under **E4a**, which the tag alone reaches. **When a requirement tag or a
design-doc reference already leads the reader to the rule, prose repeating it is not
documentation — it is a second copy, free to go stale on its own.**

Two rules follow:

- **A block whose prose fits on one line is written on one line**, `/** … */`. `/**` and `*/`
  holding their own lines is a formatting choice, not a requirement — this repo already has 66
  single-line blocks. Measured across the codebase, that choice alone costs **334 lines**, and
  reflowing without deleting a word of prose recovers **531**.
- **A tag can be a complete comment.** `/** UC-021 E4a. */` is finished. Add prose only for what
  the referenced document does *not* say — an implementation constraint the SRS could not know
  about.

### The comment budget is a ratio, and a ratio has a floor — a low one

`scripts/comment-budget.mjs` flags a file whose comments exceed 25% of its lines. That threshold
is reachable for most files and genuinely unreachable for a few. The difference is worth stating
precisely, because an earlier version of this section got it wrong and the error is instructive.

The arithmetic is real: a 25% budget on *N* code lines allows *N/3* comment lines, and a small
file with several exported symbols has very little room. What that does **not** justify is the
delimiter cost. The earlier version argued the budget was unreachable because *"JSDoc spends two
of those lines on `/**` and `*/` before a word is written."* The single-line form spends none.
Every ratio it quoted was a formatting choice reported as arithmetic:

| file | claimed floor | actual, compactly written |
| --- | ---: | ---: |
| `lib/presence/types.ts` | 60.5% | **34.8%** |
| `lib/files/serving.ts` | 56.3% | **30.0%** |
| `lib/blocks/types.ts` | 30.7% | **24.8%** |
| `editor.tsx` | 34.0% | **21.9%** |

Across the codebase the same correction took the comment ratio from 40.0% to 23.6% — under the
budget, with no protected sentence deleted.

**The real floor is content, and it binds on small files only.** Of the 21 files still over
budget, 17 hold 40 code lines or fewer. `lib/focus/pathname.ts` is the clearest: three code lines,
a budget of one, and a comment that has to say both what the function returns and why the file
exists apart from its only caller (Node's test runner cannot import a client component). Two lines
over, and correct there.

So: **the budget routes, it does not adjudicate.** Over budget means "look at whether the
rationale outgrew the code." Before concluding it did not, check in this order:

1. **Is the prose restating a document the comment already cites?** Cut it to the citation. A
   requirement tag reaches the rule on its own: `/** UC-021 E4a. */` is a complete comment when
   `SRS-ko.md` carries E4a, and the four-line paraphrase it replaces was a second copy free to go
   stale.
2. **Is a multi-line block carrying one sentence?** Reflow it to one line.
3. **Is this design rationale at all?** Then it belongs in `docs/design/`, and the code keeps
   kind 4's one-line pointer.

Only a file that survives all three and is still over budget is honestly over budget. Say so in
the PR and leave it — that is a passing result, not a deferred one.

What tracks the problem better than the ratio is the size of the *blocks*: a comment of eight
lines or more is nearly always design rationale that belongs in `docs/`. One caution, learned the
hard way: an audit that lists only blocks of eight lines and up will never show you the three- and
four-line comments inside function bodies, and this repo had more lines in those than the long
blocks the audit was built to find.

### The `simple:` marker

A one-line marker for a spot that was deliberately kept simple, naming the specific cost that
simplicity accepts — a cadence with no easing, a synchronous call where an async one would be
"more correct," a state with no recovery path. The name matches `AGENTS.md` §3 principle 2,
*"Simplicity first."*

```ts
// simple: a plain interval, no easing or adaptive cadence.
```

The marker exists to be found: it's a place a reader can search for "what did we decide not to
build yet," and a future issue (like `#37`, which references one of these directly) can point at
by name instead of re-deriving why the simple version was chosen.

## The Node type-stripping constraint

`server/index.mts` is run directly by `node` — the `Dockerfile`'s runtime stage ends in
`CMD ["node", "server/index.mts"]`, and `package.json`'s `dev` and `start` scripts do the same,
not through Next's bundler. It imports `lib/auth/session-cookie.ts` with the `.ts` extension
included, and Node's native type-stripping resolves import specifiers literally — it does not
add extensions the way a bundler does. That's why `allowImportingTsExtensions` is on in
`tsconfig.json`, and why every **relative** import reachable from `server/index.mts` has to carry
its source file's own extension (`.ts` for `session-cookie.ts`, `.mts` for `./ws-hub.mts` — not
always literally `.ts`). This does not extend to package specifiers (`next`) or Node built-ins
(`node:http`), which resolve through their own mechanisms and take no extension at all — the rule
is about relative TypeScript imports specifically, not imports in general.

`node --test` (`*.test.mts`) hits the identical constraint, for the identical reason — it's the
same runtime, doing the same literal resolution. It is not, however, the *cause*: a comment that
credits the test runner for this constraint is describing a symptom as the source, and would
mislead the next person into thinking the constraint goes away once the test runner changes. It
doesn't — `server/index.mts` still runs the same way in production regardless of what runs the
tests.

**Revise this section once #66 (Phase 2) migrates the runner to Vitest.** The paragraph above
stops being true, not just stale — tests won't run under `node --test` at all once that lands,
so "hits the identical constraint, for the identical reason" would be describing a runner this
repo no longer uses. Drop that paragraph; keep only the production-side reasoning, which doesn't
change (`server/index.mts` still runs directly under `node` regardless of what runs the tests).

## Why `next.config.ts` picks a different `distDir` for `pnpm dev`

`dev` sets `NODE_ENV=development` explicitly, `start` sets `production`, and `build` sets
neither — a bare `next build` forces production mode internally regardless of the shell's
`NODE_ENV`. So `distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next"` lands
in `.next` for both `next build` and `pnpm start`, matching the Dockerfile's
`COPY --from=build /app/.next`, and only in `.next-dev` for `pnpm dev`.

**Don't "fix" the unset case to match `server/index.mts`'s own `dev` flag
(`NODE_ENV !== "production"`).** The two look inconsistent — unset `NODE_ENV` reads as
production here but as dev in that flag — but changing this condition to match would break the
one thing it has to get right: the Dockerfile's `build` stage runs `pnpm build` with `NODE_ENV`
unset, and the copy step afterward only looks in `.next`. The inconsistency is real but
unreachable — nothing invokes `node server/index.mts` directly with `NODE_ENV` unset; `dev` and
`start` both set it, and the container sets it via `ENV`.

## Verifying a Tailwind class before trusting it

Before using a Tailwind class that's new to this project — a numeric step or color no existing
file uses yet — grep the compiled `.next/dev/static/chunks/*.css` for it. **Search for the
generated selector, not the raw class name**: Tailwind backslash-escapes any character a CSS
identifier can't contain, so `size-3.5` compiles to `.size-3\.5`, and a plain literal search for
`size-3.5` will not match that — the escape sits exactly where the search string expects a plain
`.`. The same applies to arbitrary-value classes with `[`, `]`, `#`, or `/`. Either search with
the backslash already in place (`size-3\.5`), or search for the substring on either side of the
special character and confirm the rest by eye.

Three separate silent failures in one milestone (`border-sky`, `rounded-sm`/`opacity-70`,
`size-3.5`) had this exact shape: the class simply didn't compile, with no error, and the fix
each time was the same — swap to a value already proven elsewhere in the project. The underlying
Turbopack/Tailwind v4 cause was never worth chasing down; the check above is cheaper than
debugging why a class silently produced no rule.
