# Drift audit: the design docs against the code since #184 — lessons

**Created**: 2026-10-23

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **A checklist left unticked for four days still applied almost unchanged.** Only one of its 40 items had gone stale, and it was a feature landing (#242), not an edit to the doc. Line numbers had drifted, though, so each item was found by its text, not its line.

## What we would do differently

- **Post the auditors' raw findings, not only the checklist.** Taking the run over from another session meant working from the one-line fixes on #228. The finding bodies stayed in the first session's scratchpad, so each item had to be re-derived from the doc and the code.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **For the skill's step 6:** attach `audit/*.json` and `verify-AF.json` to the audit issue, or commit them under the task, so another session can resume at step 7.
