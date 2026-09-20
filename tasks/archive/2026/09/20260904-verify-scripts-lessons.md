# Verify scripts — lessons

**Created**: 2026-09-04

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **Three real bugs in the ownership checker were invisible to reading the code and only showed
  up by running it.** A multi-line `**Owns**:` entry silently lost everything past its first
  line (regex `.` doesn't span newlines). Prose *inside* an Owns entry that happened to
  backtick-quote a path — a cross-reference, a caveat naming an excluded file, even a sentence
  written to explain the first bug, which quoted the exact tokens that trigger it — got read as
  a real claim. And the CLI entry-point guard compared `import.meta.url` against a hand-built
  `file://` string missing the third slash Windows needs before a drive letter, so
  `node scripts/verify-doc-ownership.mjs` silently ran nothing and exited 0 — the single most
  dangerous kind of bug a script can have, because "it didn't crash" looks identical to "it
  passed."
- **A prose sentence explaining a parser's own trigger pattern can trigger it.** Rewriting
  `architecture.md`'s Owns line to explain "the checker only reads `lib/`/`app/` paths" used
  exactly those tokens in backticks, which the checker then read as two claims covering
  everything. Happened twice — the second time from a sentence written specifically to prevent
  the first occurrence. Fixed by moving that kind of explanation to the script's own comments,
  where quoting its own trigger pattern is safe, and keeping the doc's Owns line to bare fact.
- **Markdown link resolution and backtick-prose resolution are genuinely different rules**, and
  conflating them broke real, working links. `docs/adr/001-realtime-sync.md` links to
  `002-persistence-on-yorkie-mongo.md` by bare filename — correct, standard markdown (resolves
  relative to the *linking file's* directory) — but an early version of the dead-link checker
  resolved every backtick/link target from the repo root, which is right for prose mentions
  (`lib/x.ts`) and wrong for real hyperlinks between sibling files.
- **A regex-based dead-link checker cannot tell present tense from past tense.**
  `docs/HOST-GUEST-ENTRY-ko.md` deliberately narrates removed paths ("app/page.tsx는
  사라졌고") as part of its own before/after explanation. "Does this path exist" has no way to
  know the sentence is *about* it not existing. Worth remembering before reaching for a similar
  checker elsewhere: it will always need a documented false-positive list for narrative
  content, not just a config bug to fix.

## What we would do differently

- Write the acceptance criteria's exact bar ("zero holes" vs. "zero duplicates and dead
  references, holes non-blocking") *after* deciding the exit-code policy, not before — milestone
  1's checklist briefly claimed a stricter bar than what was actually built, caught only because
  the pattern from `#70`'s file-count fix was fresh enough to notice the same shape recurring.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- ~~**Run a new script against the real repo before trusting it...**~~ / ~~**When writing prose
  that explains a text-matching tool's own trigger pattern, don't quote the trigger
  pattern.**~~ — **promoted 2026-09-16** to `docs/conventions.md` ("A script is not done until it
  runs against the real repo").
- ~~**A local dev machine's Node version can silently gate what "verified by running" can
  mean.**~~ — **promoted 2026-09-16** to `docs/testing.md` ("What a local Node version can
  verify, and what only CI can").
