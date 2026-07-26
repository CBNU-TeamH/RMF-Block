# Task conventions

Open work lives here as markdown. This file explains the rules; the indexes
([`../README.md`](../README.md), [`../archive/README.md`](../archive/README.md)) are generated — do not edit those by hand.

## Issue or task doc?

| Use | For |
| :--- | :--- |
| **GitHub Issue** | Anything worth tracking publicly: a bug, a request, a question. Cheap to open, cheap to close. |
| **Task doc here** | Work you are about to build. It carries the plan, the file list, and the acceptance criteria — the things an issue thread loses. |

A task doc usually links the issue it came from. An issue does not need a task doc.

## Naming

Every task is a **pair**:

```
tasks/active/YYYYMMDD-<slug>-todo.md       ← the plan
tasks/active/YYYYMMDD-<slug>-lessons.md    ← what we learned building it
```

The date is the day the task was created. Start from [`../templates/todo.md`](../templates/todo.md) and [`../templates/lessons.md`](../templates/lessons.md).

Each todo begins with `**Created**: YYYY-MM-DD`. The scripts read that line to decide which month a task belongs to, and fall back to the filename if it is missing.

## Lifecycle

```bash
cp tasks/templates/todo.md    tasks/active/20260727-block-lock-todo.md
cp tasks/templates/lessons.md tasks/active/20260727-block-lock-lessons.md
pnpm tasks:index                        # refresh the indexes

# ... build it ...

pnpm tasks:archive 20260727-block-lock  # moves the pair to archive/YYYY/MM/ and reindexes
```
