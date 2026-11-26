# Drift audit: the design docs against the code since #228 — lessons

**Created**: 2026-11-26

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- Two paragraphs sat in `document-editing.md` twice, word for word, and no check noticed: the 8-word-shingle count only compares one doc against another, never a doc against itself.

## What we would do differently

- Scoping by code churn since the last audit kept seven parts to one session; the parts with little churn (api, shell-files, floating-chat) found nothing, which is what the scoping predicted.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- `baseline.mjs` could count shingles a doc repeats within itself; that would have caught the duplicated paragraphs.
