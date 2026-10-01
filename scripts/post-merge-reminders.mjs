#!/usr/bin/env node
// Decisions for .github/workflows/post-merge-reminders.yml, kept out of the
// YAML so they can be tested: which tasks a merged PR left in tasks/active/,
// and whether enough tasks have been archived since the last drift audit that
// another is due. Prints a JSON summary; the workflow does the GitHub calls.
//
//   node scripts/post-merge-reminders.mjs --added <file listing the PR's added files>

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const THRESHOLD = 3;
// Audits start counting here when no `YYYYMMDD-drift-audit` task is archived yet.
const EPOCH = "2026-10-01";

const TODO = /^(\d{8}-[a-z0-9-]+)-todo\.md$/;

export function stillActiveTasks(addedFiles, activeFiles) {
  const active = new Set(activeFiles);
  return addedFiles.flatMap((f) => {
    const m = /^tasks\/active\/(.+)$/.exec(f);
    const slug = m && TODO.exec(m[1])?.[1];
    return slug && active.has(f) ? [slug] : [];
  });
}

// Counted by archive date (YYYY-MM-DD), not the filename's creation date: a task
// created before the last audit but archived after it is new work for the next one.
export function auditDue(archived, { threshold = THRESHOLD, epoch = EPOCH } = {}) {
  const tasks = archived.flatMap(({ path, archivedOn }) => {
    const slug = TODO.exec(basename(path))?.[1];
    return slug ? [{ slug, archivedOn }] : [];
  });
  const isAudit = (t) => t.slug === `${t.slug.slice(0, 8)}-drift-audit`;
  const since = tasks.filter(isAudit).map((t) => t.archivedOn).sort().at(-1) ?? epoch;
  const count = tasks.filter((t) => !isAudit(t) && t.archivedOn > since).length;
  return { due: count >= threshold, count, since };
}

// The archive date is the commit that added the file under tasks/archive/.
// --no-renames, so a move out of tasks/active/ reads as an add. Needs full history.
function archivedTodos(dir = "tasks/archive") {
  const log = execFileSync(
    "git",
    ["log", "--no-renames", "--diff-filter=A", "--format=%x00%cs", "--name-only", "--", dir],
    { encoding: "utf8" },
  );
  const addedOn = new Map();
  for (const entry of log.split("\0").filter(Boolean)) {
    const [date, ...files] = entry.split("\n").filter(Boolean);
    for (const f of files) if (!addedOn.has(f)) addedOn.set(f, date); // newest add wins
  }
  return readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith("-todo.md"))
    .map((f) => join(dir, f))
    .filter((path) => addedOn.has(path))
    .map((path) => ({ path, archivedOn: addedOn.get(path) }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf("--added");
  const added = i > 0 ? readFileSync(process.argv[i + 1], "utf8").split("\n").filter(Boolean) : [];
  const active = readdirSync("tasks/active").map((f) => `tasks/active/${f}`);
  console.log(
    JSON.stringify({ stillActive: stillActiveTasks(added, active), audit: auditDue(archivedTodos()) }),
  );
}
