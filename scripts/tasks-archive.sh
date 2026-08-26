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

# Resolve and check every slug before moving any of them. Bailing out halfway
# used to leave the tasks it had already moved sitting in archive/ with both
# indexes still listing them under active/, because the `exit 1` came before the
# reindex at the bottom.
slugs=()
for slug in "$@"; do
  slug=$(basename "$slug")        # tolerate a path or a "...-todo.md" being pasted in
  slug=${slug%-todo.md}
  slug=${slug%-lessons.md}

  if [ ! -f "tasks/active/$slug-todo.md" ]; then
    echo "no such task: tasks/active/$slug-todo.md" >&2
    exit 1
  fi
  slugs+=("$slug")
done

for slug in "${slugs[@]}"; do
  todo="tasks/active/$slug-todo.md"

  # Match the date itself rather than the whole `**Created**: YYYY-MM` run and
  # then strip back to it. The old form cut at the last whitespace, so a line
  # written without a space after the colon left the label attached and the
  # script happily created `tasks/archive/**Created**:2026/08/` — exit 0, no
  # warning, and the task then vanished from the archive index because
  # `tasks-index.sh`'s month glob only matches digits.
  created=$(awk 'match($0, /\*\*Created\*\*:[ \t]*[0-9]{4}-[0-9]{2}/) {
    d = substr($0, RSTART, RLENGTH)
    if (match(d, /[0-9]{4}-[0-9]{2}/)) {
      d = substr(d, RSTART, RLENGTH); sub(/-/, "/", d); print d; exit
    }
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
  # The move drops these two files two directories deeper, so every relative
  # link inside them is now short by two levels — `../../docs/x.md` has to
  # become `../../../../docs/x.md`. Every archived task in the repo has been
  # corrected by hand afterwards (see `edc0f17`); doing it here is what stops
  # that from recurring on the next archive.
  # `if`, not `[ -f … ] && …`: under `set -e` a false test makes the whole
  # compound command non-zero and kills the script.
  for moved in "$dest/$slug-todo.md" "$dest/$slug-lessons.md"; do
    if [ -f "$moved" ]; then
      sed -i 's#](\.\./\.\./#](../../../../#g' "$moved"
    fi
  done

  # And repoint anything that linked *at* the task while it was active. The slug
  # is date-prefixed and unique, so this cannot match something else by accident.
  # `grep` exits 1 when it matches nothing, which is the normal case here and
  # must not fail the run — hence the `|| true` before `pipefail` sees it.
  referrers=$(grep -rl --include='*.md' "tasks/active/$slug-" . 2>/dev/null || true)
  if [ -n "$referrers" ]; then
    echo "$referrers" | while IFS= read -r ref; do
      sed -i "s#tasks/active/$slug-#$dest/$slug-#g" "$ref"
    done
  fi

  echo "archived $slug → $dest/"
done

bash scripts/tasks-index.sh
