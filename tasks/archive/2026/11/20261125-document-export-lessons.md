# Export a document as Markdown or PDF — lessons

**Created**: 2026-11-25

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The isolated E2E stack failed to build from this checkout because of an ignored local folder (`.ds-sync/`) with a file Docker's build context refused. `.gitignore` keeping it out of git did not keep it out of the build context, which `.dockerignore` decides. Building from `git archive HEAD` avoided it.
- A Markdown link destination in angle brackets still takes `%` as an escape and `#` as a fragment, so a file named `Issue #3.png` linked to nothing until both were encoded (caught by `/code-review`, not the tests).

## What we would do differently

- Check a new CSS property against the SRS's browser floor (Firefox 148, Safari 26) before relying on it. `field-sizing: content` looked like a one-line print fix and skipped two supported browsers; CodeRabbit caught it in round 2.
- Hide floating UI in print from one place. Tagging each `fixed` overlay with `print:hidden` missed the editor's own prompts until `/simplify` found them.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Nothing yet.
