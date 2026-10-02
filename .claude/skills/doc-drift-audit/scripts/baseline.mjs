#!/usr/bin/env node
// Size and redundancy baseline for the doc set an audit covers: per-part files/bytes/lines,
// 8-word runs shared between doc pairs, and history-narration markers. Run it before and
// after a cleanup (with --ref) to show what the cleanup actually removed.
// Usage: baseline.mjs --parts <parts.json> [--ref <git-ref>] [--json]
//   parts.json: derive-parts.mjs output ({part:{docs,code}}) or a plain {part:[doc paths/globs]}.

import { matchesGlob } from "node:path";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28 });
const MARKERS = /corrected \d{4}|re-measured|reconsidered|measured against/gi;

export const shingles = (text, n = 8) => {
  const w = text.toLowerCase().match(/\w+/g) ?? [];
  const s = new Set();
  for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(" "));
  return s;
};

export function baseline(parts, ref, top = 8) {
  const all = ref ? git("ls-tree", "-r", "--name-only", ref).split("\n").filter(Boolean) : git("ls-files").split("\n").filter(Boolean);
  const read = (p) => (ref ? git("show", `${ref}:${p}`) : readFileSync(p, "utf8"));
  const docs = new Map(); // path -> text; entries missing at the ref are skipped
  const rows = Object.entries(parts).filter(([part]) => part !== "_unowned").map(([part, entry]) => {
    const pats = Array.isArray(entry) ? entry : entry.docs; // derive-parts output works as-is
    // Exact path, a directory (with or without the trailing /), or a * / ? glob — `[` is literal
    // here because Next paths contain `[id]`.
    const hit = (f, p) => f === p || f.startsWith(p.endsWith("/") ? p : `${p}/`) || (/[*?]/.test(p) && matchesGlob(f, p));
    const matched = pats.map((p) => [p, all.filter((f) => hit(f, p))]);
    for (const [p, fs] of matched) if (!fs.length) console.error(`baseline: "${p}" matches no file${ref ? ` at ${ref}` : ""} — counted as 0`);
    const files = [...new Set(matched.flatMap(([, fs]) => fs))];
    let bytes = 0, lines = 0;
    for (const f of files) {
      if (!docs.has(f)) docs.set(f, read(f));
      const text = docs.get(f);
      bytes += Buffer.byteLength(text);
      lines += text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
    }
    return { part, files: files.length, bytes, lines };
  });
  const total = rows.reduce((t, r) => ({ files: t.files + r.files, bytes: t.bytes + r.bytes, lines: t.lines + r.lines }), { files: 0, bytes: 0, lines: 0 });
  const sh = new Map([...docs].map(([p, t]) => [p, shingles(t)]));
  const names = [...docs.keys()], pairs = [];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      let c = 0;
      for (const s of sh.get(names[i])) if (sh.get(names[j]).has(s)) c++;
      if (c) pairs.push({ a: names[i], b: names[j], shared: c });
    }
  pairs.sort((x, y) => y.shared - x.shared);
  const markers = Object.fromEntries([...docs].map(([p, t]) => [p, (t.match(MARKERS) ?? []).length]));
  return { rows, total, pairs: pairs.slice(0, top), markers };
}

export function render({ rows, total, pairs, markers }) {
  const L = ["| Part | Files | Bytes | Lines |", "| --- | ---: | ---: | ---: |"];
  for (const r of [...rows, { part: "**Total**", ...total }]) L.push(`| ${r.part} | ${r.files} | ${r.bytes.toLocaleString("en-US")} | ${r.lines.toLocaleString("en-US")} |`);
  L.push("", `### Shared 8-word runs (top ${pairs.length})`, "");
  for (const p of pairs) L.push(`- ${p.a} ↔ ${p.b}: ${p.shared}`);
  L.push("", "### History-narration markers", "");
  for (const [p, n] of Object.entries(markers)) if (n) L.push(`- ${p}: ${n}`);
  return L.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values: o } = parseArgs({ options: { parts: { type: "string" }, ref: { type: "string" }, json: { type: "boolean" } } });
  const r = baseline(JSON.parse(readFileSync(o.parts, "utf8")), o.ref);
  console.log(o.json ? JSON.stringify(r, null, 2) : render(r));
}
