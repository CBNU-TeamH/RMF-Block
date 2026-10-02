#!/usr/bin/env node
// Checks facts that docs declare against the code's AST, so a claim like "only app/** calls
// createRevision" fails when the code changes instead of rotting. A doc holds any number of
//   <!-- declare: <name>
//   called-only-from: <callee>[|<callee>…] in <glob>[, <glob>…]   # every call site matches; >=1 exists
//   never-called: <callee>[|<callee>…]                            # 0 call sites
//   const: <file> <NAME> = <JSON value>                           # top-level literal, deep-equal
//   const: <file> <NAME> includes [<JSON values…>]                # array literal contains all
//   exists: <file> <symbol>                                       # top-level declaration
//   -->
// One predicate per line, `#` starts a trailing comment. A call site is a call whose callee is
// `name(…)` or `x.name(…)` in non-test app/lib/server/scripts code; comments and strings never count.
// Declare blocks inside fenced code are ignored (examples). Exit 1 on a failed fact, an unknown predicate or an unparseable block.
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { gl, listFiles, scriptKind } from "./lib/ast-facts.mjs";
import { stripFences } from "./lib/headings.mjs";

export function parseDeclarations(text, file) {
  const decls = [], errors = [];
  text = stripFences(text); // documented examples are not parsed
  const starts = [...text.matchAll(/<!--\s*declare:/g)];
  for (const [i, start] of starts.entries()) {
    const line0 = text.slice(0, start.index).split("\n").length;
    const end = text.indexOf("-->", start.index + start[0].length);
    if (end < 0 || end >= (starts[i + 1]?.index ?? text.length)) {
      errors.push(`${file}:${line0}  unclosed declaration block`);
      continue;
    }
    const m = text.slice(start.index, end + 3).match(/^<!--\s*declare:([^\n]*)\n([\s\S]*?)-->$/);
    if (!m) {
      errors.push(`${file}:${line0}  malformed declaration block: expected multiline format`);
      continue;
    }
    const d = { file, line: line0, name: m[1].trim(), preds: [] };
    m[2].split("\n").forEach((raw, i) => {
      const l = raw.replace(/\s#(?=(?:[^"]*"[^"]*")*[^"]*$).*$/, "").trim(); // a # inside a "string" is not a comment
      if (!l || l.startsWith("#")) return;
      const at = `${file}:${line0 + 1 + i}`;
      const p = l.match(/^(called-only-from|never-called|const|exists):\s*(.*)$/);
      if (!p) return errors.push(`${at}  unknown predicate: ${l}`);
      const [, kind, arg] = p;
      let r;
      if (kind === "called-only-from" && (r = arg.match(/^([\w$|]+) in (.+)$/)))
        d.preds.push({ kind, line: l, at, callees: r[1].split("|"), globs: r[2].split(",").map((g) => g.trim()) });
      else if (kind === "never-called" && /^[\w$|]+$/.test(arg)) d.preds.push({ kind, line: l, at, callees: arg.split("|") });
      else if (kind === "const" && (r = arg.match(/^(\S+) ([\w$]+) (=|includes) (.+)$/))) {
        try { d.preds.push({ kind, line: l, at, path: r[1], sym: r[2], op: r[3], value: JSON.parse(r[4]) }); }
        catch { errors.push(`${at}  bad JSON value: ${r[4]}`); }
      } else if (kind === "exists" && (r = arg.match(/^(\S+) ([\w$]+)$/))) d.preds.push({ kind, line: l, at, path: r[1], sym: r[2] });
      else errors.push(`${at}  malformed ${kind}: ${arg}`);
    });
    decls.push(d);
  }
  return { decls, errors };
}

// files: the scanned code paths (relative to root); tests and this script are dropped from call scans.
export function buildIndex({ root, files, typescript }) {
  const ts = typescript ?? createRequire(root + "/package.json")("typescript");
  const cache = new Map();
  let calls; // callee name -> call sites, built in one walk on first use
  const parse = (rel) => {
    if (!cache.has(rel)) cache.set(rel, ts.createSourceFile(rel, readFileSync(join(root, rel), "utf8"), ts.ScriptTarget.Latest, true, scriptKind(ts, rel)));
    return cache.get(rel);
  };
  const scan = files.filter((f) => /\.(ts|tsx|mts|mjs)$/.test(f) && /^(app|lib|server|scripts)\//.test(f)
    && !/\.test\./.test(f) && f !== "scripts/verify-declarations.mjs");
  const callSites = (name) => {
    if (!calls) {
      calls = new Map();
      for (const f of scan) {
        const sf = parse(f);
        const walk = (n) => {
          if (ts.isCallExpression(n)) {
            const c = n.expression;
            const callee = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : null;
            if (callee) {
              if (!calls.has(callee)) calls.set(callee, []);
              calls.get(callee).push({ file: f, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
            }
          }
          ts.forEachChild(n, walk);
        };
        walk(sf);
      }
    }
    return calls.get(name) ?? [];
  };
  return { root, ts, parse, callSites, exists: (f) => existsSync(join(root, f)) };
}

const isLit = (ts, e) => ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isNumericLiteral(e)
  || e.kind === ts.SyntaxKind.TrueKeyword || e.kind === ts.SyntaxKind.FalseKeyword || e.kind === ts.SyntaxKind.NullKeyword;

// AST literal -> JS value; throws on anything non-literal.
function litValue(ts, e) {
  if (ts.isAsExpression(e) || ts.isSatisfiesExpression?.(e) || ts.isParenthesizedExpression(e)) return litValue(ts, e.expression);
  if (isLit(ts, e)) return ts.isNumericLiteral(e) ? Number(e.text) : e.kind === ts.SyntaxKind.TrueKeyword ? true : e.kind === ts.SyntaxKind.FalseKeyword ? false : e.kind === ts.SyntaxKind.NullKeyword ? null : e.text;
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(e.operand)) return -Number(e.operand.text);
  if (ts.isArrayLiteralExpression(e)) return e.elements.map((x) => litValue(ts, x));
  if (ts.isObjectLiteralExpression(e)) return Object.fromEntries(e.properties.map((p) => {
    if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) throw new Error("non-literal property");
    return [p.name.text, litValue(ts, p.initializer)];
  }));
  throw new Error("non-literal initializer: " + e.getText().slice(0, 40));
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b); // key order matters; fine for declared literals

function topDecl(ix, rel, sym) {
  const { ts } = ix, sf = ix.parse(rel);
  const at = (n) => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === sym) return { at: at(d), init: d.initializer };
    } else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) && st.name?.text === sym) return { at: at(st) };
    else if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause) && st.exportClause.elements.some((e) => e.name.text === sym)) return { at: at(st) };
  }
  return null;
}

// -> null when the fact holds, else a reason string (with file:line evidence where there is one).
export function evaluate(p, ix) {
  if (p.kind === "called-only-from" || p.kind === "never-called") {
    const res = p.globs?.map(gl);
    for (const c of p.callees) {
      const sites = ix.callSites(c);
      if (p.kind === "never-called") { if (sites.length) return `${c} is called at ${sites[0].file}:${sites[0].line} (${sites.length} sites)`; continue; }
      if (!sites.length) return `${c}: no call sites`;
      const bad = sites.find((s) => !res.some((r) => r.test(s.file)));
      if (bad) return `${c} called outside ${p.globs.join(", ")} at ${bad.file}:${bad.line}`;
    }
    return null;
  }
  if (!ix.exists(p.path)) return `${p.path} does not exist`;
  const d = topDecl(ix, p.path, p.sym);
  if (!d) return `no top-level declaration ${p.sym} in ${p.path}`;
  if (p.kind === "exists") return null;
  if (!d.init) return `${p.sym} has no initializer (${d.at})`;
  let v;
  try { v = litValue(ix.ts, d.init); } catch (e) { return `${e.message} (${d.at})`; }
  if (p.op === "=") return same(v, p.value) ? null : `${p.sym} is ${JSON.stringify(v)} (${d.at})`;
  if (!Array.isArray(v) || !Array.isArray(p.value)) return `includes needs array literals (${d.at})`;
  const miss = p.value.filter((x) => !v.some((y) => same(x, y)));
  return miss.length ? `${p.sym} lacks ${JSON.stringify(miss)} (${d.at})` : null;
}

export function check({ root, docsDir = "docs", typescript }) {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".md") ? [join(d, e.name)] : []);
  const dir = resolve(root, docsDir);
  const docs = existsSync(dir) ? walk(dir) : [];
  const ix = buildIndex({ root, files: listFiles(root), typescript });
  const failures = [];
  let facts = 0, blocks = 0;
  for (const doc of docs) {
    const { decls, errors } = parseDeclarations(readFileSync(doc, "utf8"), relative(root, doc));
    failures.push(...errors);
    for (const d of decls) {
      blocks++;
      for (const p of d.preds) {
        facts++;
        const why = evaluate(p, ix);
        if (why) failures.push(`${p.at}  ${d.name}  ${p.line}  →  ${why}`);
      }
    }
  }
  return { failures, facts, blocks };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf("--docs");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const { failures, facts, blocks } = check({ root, docsDir: i > 0 ? process.argv[i + 1] : "docs" });
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log(`Declarations: clean — ${facts} facts in ${blocks} blocks`);
}
