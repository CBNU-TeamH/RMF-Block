# Pasting into blocks, and the image and file legs — lessons

**Created**: 2026-09-07

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **`readableSize`'s comment named its own expiry condition, and this task met it.** It said the
  formatter was restated rather than shared because there were "six lines, two callers, and no
  behaviour rides on the two agreeing". The image and file blocks make four, so it moved to
  `lib/files/size.ts`. Second time in two tasks a comment that stated the condition under which it
  would be wrong turned out to be the cheapest kind to maintain — `list-numbering.ts`'s "depth is
  ignored: nothing yet lets a list item nest" was the first.

- **The upload endpoint was already the security boundary; only its answer changed.** Widening it
  past PDF looked like it needed new defences and needed none: `serving.ts` already answered `inline`
  only for a stored type in `INLINE_TYPES`, and `download` was already unconditional
  `octet-stream` + `attachment`. All that was missing was one more sniffer, because the invariant
  the design already had — *the stored type is one this server proved* — does the work.

## What we would do differently

- **`ls` and `cat >` in one command is how a test file gets overwritten.** `lib/files/upload.test.mts`
  already existed; the `ls` that would have said so printed *after* the heredoc had already
  replaced it, and six `readUpload` tests were gone. Caught because the suite grew by 2 where 11
  were added. Restored from git and appended to instead. **Check for the file, then write, as two
  steps — and read the suite count, not just "0 failures".**

- **Verify the interaction the moment the browser is available.** The extension disconnected
  mid-check, after the upload path was proven by `curl` but before the paste handler and the two
  renderers were seen working. The pure logic is covered by tests either way, but "the handler
  writes what the parser returned" is not something a unit test reaches.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **A comment that names the condition under which it becomes wrong is worth the extra clause.**
  Twice now — `list-numbering.ts`'s "nothing yet lets a list item nest" and `readableSize`'s "two
  callers" — a comment told the next person exactly when to come back to it, and both were acted
  on the moment the condition was met rather than drifting. Proposal for `docs/conventions.md`,
  beside the five comment kinds: when a decision holds only under a condition, write the condition.

- **`accept` on a file input is a hint, not a check.** Removing `accept="application/pdf,.pdf"` was
  part of widening uploads, and it is worth writing down that it never enforced anything — a drag
  and drop bypasses it entirely, which is why the byte sniffing is the only real gate.
