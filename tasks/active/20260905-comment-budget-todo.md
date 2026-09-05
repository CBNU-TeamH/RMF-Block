# Bring the comment budget down, starting with `lib/presence/types.ts`

**Created**: 2026-09-05
**Issue**: #65 — this closes the first of Phase 1's six gate criteria ("comment ratio of files
touched by those tasks is at or below 25%").
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

`docs/conventions.md`: **could a reader derive this from the code?** Three kinds survive —
an external constraint the code cannot express, a one-line requirement tag, a `simple:` marker.
Everything else belongs in `docs/design/`.

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

### What the next 49 files need first

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
