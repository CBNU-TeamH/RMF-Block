# Keep docs in sync: one fact in one place, and reminders where the work happens — lessons

**Created**: 2026-10-01

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- The doc checks never ran in CI, so the drift #126 found (a shipped decision still "open" in four docs, a call path drawn backwards in three) passed every existing check.
- A task's archive date has to come from the commit that moved it into `tasks/archive/`, not from its filename: a task created before the last audit but archived after it is new work for the next one.
- `post-merge-reminders.yml` has two jobs and only one counts correctly. The `archive` job checks out one commit, so every archived file looks added by that commit and its `audit` field reads `count 0, since <merge date>`. Only `stillActive` is used from it. The `audit` job checks out full history, and its line is the real count.

## What we would do differently

- Give the `archive` job the same full-history checkout as the `audit` job, or stop printing an audit field it cannot compute, so a log line from it cannot be mistaken for the real count.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- A workflow that holds a write token takes nothing from a fork except a validated PR number, and runs the default branch's code. The two-stage `doc-reminders.yml` / `doc-reminders-comment.yml` pair is the template.
