#!/usr/bin/env bash
# Moves finished task pairs from tasks/active/ to tasks/archive/YYYY/MM/, then reindexes.
#
#   bash scripts/tasks-archive.sh 20260727-block-lock [...]
#
# The month comes from the "**Created**: YYYY-MM-DD" line in the todo, falling back
# to the YYYYMMDD filename prefix.
set -euo pipefail
shopt -s nullglob

cd "$(dirname "$0")/.."

if [ $# -eq 0 ]; then
  echo "usage: $0 <task-slug>..." >&2
  echo >&2
  echo "in progress:" >&2
  for f in tasks/active/*-todo.md; do
    echo "  $(basename "$f" -todo.md)" >&2
  done
  exit 1
fi

for slug in "$@"; do
  slug=$(basename "$slug")        # tolerate a path or a "...-todo.md" being pasted in
  slug=${slug%-todo.md}
  slug=${slug%-lessons.md}
  todo="tasks/active/$slug-todo.md"

  if [ ! -f "$todo" ]; then
    echo "no such task: $todo" >&2
    exit 1
  fi

  created=$(awk 'match($0, /\*\*Created\*\*:[ \t]*[0-9]{4}-[0-9]{2}/) {
    d = substr($0, RSTART, RLENGTH); sub(/.*[ \t]/, "", d); sub(/-/, "/", d); print d; exit
  }' "$todo")
  if [ -z "$created" ]; then
    # ponytail: filename fallback assumes the YYYYMMDD- prefix the convention requires.
    created="${slug:0:4}/${slug:4:2}"
    echo "warning: $todo has no '**Created**:' line, using filename → $created" >&2
  fi

  dest="tasks/archive/$created"
  mkdir -p "$dest"
  mv "$todo" "$dest/"
  if [ -f "tasks/active/$slug-lessons.md" ]; then
    mv "tasks/active/$slug-lessons.md" "$dest/"
  fi
  echo "archived $slug → $dest/"
done

bash scripts/tasks-index.sh
