# Drift audit: doc-code drift and doc compression — lessons

**Created**: 2026-10-02

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- **Auditors read stale content.** About 6% of A findings were false: they described text that had already been fixed. A separate pass that re-checked every A/F finding against the files on disk caught them. Budget for that pass.
- **Approved fixes overlap across agents.** Grouping the checklist by the file each item edits put overlaps next to each other, and splitting the edit agents by file meant their commits never conflicted. Cross-file items came back as handoffs instead.
- **Worktrees have no `node_modules`,** so the pre-commit hook fails there. Edit agents can make doc commits; anything that has to pass the hooks gets committed in the main checkout.
- **Closing the audit issue on merge isn't enough.** The audit count only resets once the audit task is archived, so archiving it after merge would reopen the issue. The audit PR archives its own task.

## What we would do differently

- Keep cross-doc moves out of the per-category fixups from the start. A fixup into the C commit conflicted with the later D commit in the same file. A separate "move to owner" commit after D is simpler.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- **The whole procedure, as a skill.** `doc-drift-audit`: baseline → parts → extract → audit → verify A/F → checklist → apply in worktrees → measure → archive the audit task in the PR. It is drafted in the session scratchpad, and becomes its own issue and PR next.
