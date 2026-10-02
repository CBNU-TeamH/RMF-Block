#!/usr/bin/env node
// Mirrors repo-authored skills from `.claude/skills/` (canonical — edit only there) to
// `.agents/skills/`, the directory Codex, Gemini CLI, Cursor and OpenCode scan. A copy,
// not a symlink: on a Windows checkout with core.symlinks=false git turns a symlink into a
// one-line text file, and the skill would silently vanish for those agents.
//
//   node scripts/sync-skills.mjs          copy each skill (adds, updates, removes its stale files;
//                                         skills that exist only in .agents/skills are left alone)
//   node scripts/sync-skills.mjs --check  fail if the mirror differs (run by `pnpm verify:docs`)

import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const SRC = ".claude/skills";
const DST = ".agents/skills";

function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)))
    .sort();
}

// Only the skills that exist under SRC are mirrored: a skill another tool installed directly in
// DST is not ours to check or delete.
const skills = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);

export function diff(src = SRC, dst = DST) {
  const mine = skills(src);
  const ours = (f) => mine.some((s) => f === s || f.startsWith(`${s}/`));
  const a = files(src);
  const b = files(dst).filter(ours);
  const inDst = new Set(b);
  const missing = a.filter((f) => !inDst.has(f) || !readFileSync(join(src, f)).equals(readFileSync(join(dst, f))));
  const inSrc = new Set(a);
  const stale = b.filter((f) => !inSrc.has(f));
  return { missing, stale, count: a.length };
}

function main() {
  const { missing, stale, count } = diff();
  if (process.argv.includes("--check")) {
    if (missing.length + stale.length === 0) {
      console.log(`Skills mirror: clean — ${DST} matches ${SRC}.`);
      return;
    }
    console.log(`Skills mirror: ${DST} differs from ${SRC} — run \`pnpm skills:sync\`.`);
    for (const f of missing) console.log(`  out of date: ${f}`);
    for (const f of stale) console.log(`  not in ${SRC}: ${f}`);
    process.exitCode = 1;
    return;
  }
  // Never delete the mirror without a source to rebuild it from (a partial checkout).
  if (!existsSync(SRC)) {
    console.error(`${SRC} not found — nothing to copy; ${DST} left as it is.`);
    process.exitCode = 1;
    return;
  }
  for (const s of skills(SRC)) {
    rmSync(join(DST, s), { recursive: true, force: true });
    cpSync(join(SRC, s), join(DST, s), { recursive: true });
  }
  console.log(`Copied ${count} files from ${SRC} to ${DST}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
