# Bring the comment budget down — lessons

**Created**: 2026-09-05

## What surprised us

- **The 25% budget is arithmetically unreachable for a small declaration file, and
  `lib/presence/types.ts` is one.** After deleting every sentence the design doc already
  carries, the file is 15 code lines and 23 comment lines — **60.5%**. Twelve of those 23
  are `/**`, ` */` and blank ` *` separators, not prose. Hitting 25% against 15 code lines
  means a comment budget of **five lines**, and the content `docs/conventions.md` itself says
  must stay — the Yorkie key charset, the `JSON.stringify`/`undefined` constraint, three
  requirement tags — is seven lines before a single delimiter. The threshold cannot be met
  without deleting exactly what the rulebook protects.

  This is gate criterion 3's first real data point: not a bug in `comment-budget.mjs`, but a
  case where a **ratio** is the wrong measure. A 40-line file with three exports has no room;
  the same three comments in a 300-line file would pass unnoticed.

- **`comment-budget.mjs` reads `git show HEAD:path`, not the working tree.** So it says
  "clean" while you are editing and only speaks after you commit or stage. `--staged` is the
  flag to use mid-work; the plain form is for reviewing what already landed. Worth knowing
  before concluding the tool is broken, as we briefly did.

- **The rulebook has no entry for the pointer it creates.** `conventions.md` names three kinds
  of comment that may stay. Moving rationale to `docs/design/` leaves a fourth thing behind —
  a line saying where it went — which #70 already established as the pattern
  (`"See docs/design/presence-and-focus.md for why the hub was not used"`) but which the rules
  never mention. Same for the one-line "what this exported symbol is". Both were kept here on
  S-5 grounds (follow the existing precedent), not because a rule allows them.

## What we would do differently

- **Check the destination before writing it.** #70 created `presence-and-focus.md` *as* the
  destination for this file's rationale and left the rationale in place — the file went 74% →
  75%. Writing the doc and deleting the comments belong in the same change, or the deletion
  never happens.

## Worth extracting

- **Measure long-block lines, not a ratio.** The audit that opened this task counted comment
  blocks of eight lines or more: 1,533 of 2,595 comment lines across 50 files. That number
  tracks "rationale that outgrew the code" far better than a percentage, and it does not
  punish a small file for documenting its exports. Proposal for `comment-budget.mjs`: keep the
  ratio as the headline, add an absolute long-block count, and exempt files under ~40 code
  lines from the ratio alone.
- **`conventions.md` should name two more kinds that may stay**: a cross-reference to the
  design doc that now owns the rationale, and a one-line statement of what an exported symbol
  is. Both are already in use; neither is written down.
