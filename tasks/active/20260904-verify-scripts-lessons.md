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

- **Run a new script against the real repo before trusting it, every time — not just once.**
  Every bug above was caught by execution, not review. This is the same lesson `#68`'s
  CodeRabbit findings and `#70`'s file-count fix already taught about *content*; this task is
  the version of it for *tooling*. Worth stating in `docs/conventions.md` or `AGENTS.md`
  directly: a script is not done when it reads correctly, only when it has been run against the
  thing it checks.
- **When writing prose that explains a text-matching tool's own trigger pattern, don't quote the
  trigger pattern.** Specific enough to be a real trap (happened twice in one file) and general
  enough to recur anywhere a repo writes about its own linters/checkers in the same format the
  checker parses.
- **A local dev machine's Node version can silently gate what "verified by running" can mean.**
  This task could fully verify comment-budget.mjs and the ownership checker (pure Node, no
  version-sensitive behavior) but could only half-verify the distDir split and couldn't verify
  `node --test`'s default file discovery at all — both gated by this machine running Node 22
  against a repo that needs 24. Worth a line in `docs/testing.md` (once `#66` creates it) or
  `AGENTS.md`'s run/verify section: what CI can prove that a Node-22 local machine cannot, so
  the gap is named rather than rediscovered per task.
