# Bring the comment budget down, starting with `lib/presence/types.ts`

**Created**: 2026-09-05
**Issue**: #65 — this addresses the first of Phase 1's six gate criteria ("comment ratio of files
touched by those tasks is at or below 25%"); see the Review section for why "addresses" and
not "closes" — the literal threshold is not met on every file, deliberately.
**Design**: no new doc. The destinations already exist — that is the point of this task.
[`docs/conventions.md`](../../docs/conventions.md) is the rule being applied;
[`docs/design/`](../../docs/design/) is where the rationale goes.

## Why now

Phase 1 built the rulebook (#69), a destination (#70) and a measurement (#71). The gate it set
for itself is still open: **39% overall, median 43.1%, 52 of 61 files above 25%.**

The cheapest place to start is the one #70 already prepared and did not finish.
`docs/design/presence-and-focus.md` was written as *"the destination for the design rationale
that `lib/presence/types.ts` currently carries at 74% comments"* — the doc landed, the comments
stayed, and the file is now at **75%**. Deleting text that a design doc already says, word for
word, needs no judgement. It is the right place to fix the method before applying it to the
1,533 lines of long-block comments the audit found across 50 files.

## The rule being applied

`docs/conventions.md`: **could a reader derive this from the code?** At the time this task
started, three kinds survived — an external constraint the code cannot express, a one-line
requirement tag, a `simple:` marker. This task's own trims needed two more it could not yet cite
— a cross-reference to the design doc a rationale moved to, and a one-line statement of what an
exported symbol is — and promoted both into `conventions.md` along the way (see the Review
section). Everything else belongs in `docs/design/`.

Two lines in this file are the *first* kind and stay, even though the design doc also carries
them. `conventions.md` names both as its worked examples:

- the Yorkie key charset (`a-z A-Z 0-9 - . _ ~`) — whoever edits `WORKSPACE_DOC_KEY` needs it
  at that spot, not three files away
- the SDK `JSON.stringify`ing presence, so `undefined` cannot mean "stopped sharing"

## Milestones

### 1. `lib/presence/types.ts`

- **What**: delete the rationale `presence-and-focus.md` already carries; keep the two external
  constraints, the `FR-020-06/07`, `FR-020-08` and `UC-011` tags, and a pointer to the doc.
- **Files**: `lib/presence/types.ts`.
- **Reuse**: `presence-and-focus.md` — nothing new is written there. Every deleted sentence was
  checked against it first.
- **Done**: `pnpm comments` reports the file under 25%, and nothing deleted is absent from the
  design doc.

### 2. The method, written down

- **What**: whatever milestone 1 teaches about *how* to do this goes in the lessons file, so the
  remaining 49 files are mechanical rather than 49 fresh judgement calls.
- **Done**: a "Worth extracting" entry exists — which is also gate criterion 4, the promotion
  loop that has not run in seven months.

## Acceptance

- [ ] `lib/presence/types.ts` under 25%.
- [ ] Every deleted sentence verified present in `docs/design/presence-and-focus.md`.
- [ ] The two external constraints, and all requirement tags, still in the file.
- [ ] `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm verify:docs` (against the known 7-finding
      baseline) unchanged.

## Cross-cutting

Gate criteria this touches: **1** (ratio), **4** (the promotion loop). Criteria 2, 3, 5 and 6 are
observations to record while doing the work, not things this task produces.

## Why the first answer to "25% is unreachable" was wrong

The first pass concluded the budget had a floor around 55–60% on small files and wrote that into
`conventions.md`, with a four-row table. The argument was that JSDoc pays two lines for `/**` and
`*/` before any prose. **The single-line form `/** … */` pays none**, and the repo already had 66
blocks in that form. Every ratio in that table was a formatting choice reported as arithmetic.

Reflowing without deleting a word of prose was worth 531 lines across the codebase, 334 of them
pure delimiters. Cutting prose that merely restates a cited document — the `UC-021 E4a` case,
where four lines paraphrased one line of `SRS-ko.md` that the tag already reaches — was worth the
rest.

| file | first pass called it | actual |
| --- | ---: | ---: |
| `lib/presence/types.ts` | 60.5% floor | **34.8%** |
| `lib/files/serving.ts` | 56.3% floor | **30.0%** |
| `lib/blocks/types.ts` | 30.7% | **24.8%** |
| `editor.tsx` | 34.0% | **21.9%** |

Whole codebase: **40.0% → 23.6%**, comments 2,964 → 1,374.

### The floor is real, and it is content

21 files remain over budget; **17 hold 40 code lines or fewer**. `lib/focus/pathname.ts` is three
code lines against a budget of one, and its comment must carry both what the function returns and
why the file exists apart from its only caller. Those are the honest cases, and
`conventions.md` now says to declare them in the PR rather than defer them.

### The audit's threshold hid a third of the work

`classify.mjs` counted blocks of **eight lines or more**. Comments of three and four lines inside
function bodies never entered the worklist — 56 blocks, 188 lines, untouched through the entire
first pass while 5+ line blocks fell by a third. Those are also the ones a reader actually meets
scrolling through a function. Any future comment audit should list from three lines up.


## Review

**Milestone 1 shipped; milestone 2 turned into the finding below.**

`lib/presence/types.ts`: **75% → 60.5%**, comments 45 → 23 lines. Every deleted sentence was
checked against `docs/design/presence-and-focus.md` first — eight probes, all present (one
initially read as missing and was a line-wrap artefact in the grep, not a gap). The two external
constraints and all three requirement tags are still in the file.

**It did not reach 25%, and cannot.** With 15 code lines the budget is five comment lines, and
what `conventions.md` protects here is seven before a single `/**`. Written up in the lessons
file as gate criterion 3's first data point: the ratio is the wrong measure for a small
declaration file, and the fix is a threshold that accounts for file size rather than a harder
trim.

So acceptance item 1 is **not met as written** — deliberately. Meeting it would have required
deleting the Yorkie key charset or the `JSON.stringify` constraint, which are the two things
`conventions.md` uses this very file to illustrate.

- [x] Every deleted sentence verified present in the design doc.
- [x] Both external constraints and every requirement tag still in the file.
- [x] `pnpm lint`, `pnpm test` (349), `tsc --noEmit`, `pnpm build`.
- [ ] Under 25% — **see above**; raised as a threshold question rather than met.

### Then: the ownership gap closed, and a second file trimmed

**(b) The seven homeless files now have a home.** Four of them
(`auth/host`, `auth/yorkie-token`, `internal/yorkie/auth`, `workspace/join` route handlers) were
already described in `docs/design/api.md` — that doc simply never claimed them in its `Owns`
line. The other three had no coverage anywhere, so `api.md` gained a short **"The pieces around
it"** subsection naming what each does (`workspace-config.ts` is configuration, not state;
`yorkie-admin.ts` is what makes the webhook get called at all; `session-watch.tsx` is the client
half of FR-020-08's one-device rule) *before* the `Owns` line was widened to eight paths.
Claiming a path a doc does not describe would make the checker green and the claim false.

Coverage holes: **11 → 6.** The six left are the join screen, the workspace shell and the
document list — a real gap, but a different task's.

**A blind spot in the checker, found doing this:** `lib/` is walked at module (subdirectory)
granularity, so the five top-level files — `host-secret.ts`, `lan-address.ts`,
`workspace-config.ts`, `yorkie-address.ts`, `yorkie-admin.ts` — are invisible to it. Two of them
were among the seven and were only found because the *comment* audit listed them. Worth fixing in
`verify-doc-ownership.mjs`.

**(c) `lib/files/serving.ts`: 72% → 56%**, comments 71 → 36 lines. Same method, and it caught
something the first file did not: **three rationales were in the code and nowhere else.**
`private` caching, why the filename rides on an inline response, and why `filename*` is sent
without an ASCII `filename=`. The first two are external facts (a LAN with caches in front of it;
the browser viewer's Save button) and stayed. The third is a rejected alternative, so it moved
into `api.md` before the comment was deleted. Verifying before deleting is not a formality — it
changed the answer three times in one file.

### Third file, and a verification method that finally works

`lib/blocks/types.ts`: **59% → 31%**, comments 114 → 35 lines. The bulk of it was one shape
repeated twelve times — a `Storage: content = { … }` line per block type, against a design doc
that carries all twelve as fenced code blocks. Counted before deleting: `content = {` appears
**12 times** in `document-editing.md`.

**The keyword greps used on the first two files were unreliable** — backticks, bold and line
wraps produced false "missing" reports every time. Replaced with a script that reconstructs the
deleted sentences from the diff, strips markdown punctuation, and searches every doc for a
distinctive word run. Run against the first two files it reported 22 of 35 confirmed; going
through the 13 by hand, twelve were sentences that had been *kept* in rewritten form or matched
under different wording, and **one was a real gap** — that a non-PDF served as `application/pdf`
reaches the PDF viewer and errors rather than the HTML parser. Added to `api.md`.

The same pass on this file found **one more real gap**: the doc explains why *storage* keeps the
`content.text` wrapper but never why the *read* model drops it. That sentence is now in
`document-editing.md`.

Two real gaps in three files. The check is not a formality.

### Files four and five, and the case that reversed the assumption

`lib/blocks/operations.ts`: **47% → 33%.** This one nearly went wrong. It has the same owning doc
as the schema file, so the assumption going in was that its rationale was equally covered — and
the write-side rule it carries, **a block is named by `id`, never by index**, turned out to be
nowhere in `document-editing.md`. The doc explains that hazard carefully for *subscription paths*
(`$.blocks.0.…` names whatever sits there now) and never once for the operations API. Trimming
first would have deleted the only statement of it.

So the doc gained an **"Operations name a block by `id`, never by index"** section — including why
the id→ticket resolution stays a linear scan, which is an S-2 argument (a second index would be a
second structure to keep true) — and the comment became a pointer.

`lib/blocks/document.ts`: **33% → 28%.** The conversion-litter rationale it carried is in the doc
in full; what stayed is the LAN's lack of write validation and the `never` guard's two-failures
distinction, neither derivable from the code.

**A second stale comment surfaced**, the same sentence as in `types.ts`: "the five below cannot be
created yet", false since #54. Fixed in both.

### What the next 47 files need first

The audit behind this task (comment ratio × owning design doc, all 57 files over 30 lines):

- **50 files over 25%**, 2,595 comment lines, **1,533 of them in blocks of eight lines or more**.
- **7 of the 50 have no owning design doc** — `app/api/internal/yorkie/auth/route.ts`,
  `lib/yorkie-admin.ts`, `app/api/auth/yorkie-token/route.ts`, `lib/workspace-config.ts`,
  `app/api/auth/host/route.ts`, `app/api/workspace/join/route.ts`, `app/session-watch.tsx`.
  Five are auth/session routes whose rationale may already be in
  `docs/HOST-GUEST-ENTRY-ko.md` — it is simply not in `docs/design/`, so the ownership checker
  cannot see it. **Widening an `Owns` line may be cheaper than writing a doc.** Stripping any of
  these seven first would destroy rationale with nowhere to go.
- **Five files are already fine**: over 25% but with zero long blocks
  (`session-cookie.ts`, `chat-service.ts`, `chat-repository.ts`, `download/route.ts`,
  `documents/[id]/page.tsx`). Leave them alone.
