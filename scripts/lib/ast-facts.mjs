// Structural facts for doc-drift tooling: parses a TS/Next repo with the TypeScript compiler API
// and returns routes and their methods, client fetch/WebSocket calls matched to routes, socket
// paths, SDK call sites, env vars, infra files. A map of where to look, never evidence on its own.
// The SDK patterns (`yorkie`) are this repo's; adapt them for another stack. The drift-audit
// skill's extract-facts.mjs is the CLI; other checks import this directly.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set(['node_modules', '.next', '.data', '.git', 'coverage']);
// Every scanned path, relative to root: app/lib/server/scripts/.github plus root files.
export function listFiles(root) {
  function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else out.push(path.relative(root, p).split(path.sep).join('/')); // '/' on Windows too: every filter and glob expects it
    }
    return out;
  }
  return ['app', 'lib', 'server', 'scripts', '.github'].flatMap((d) => (fs.existsSync(path.join(root, d)) ? walk(path.join(root, d)) : []))
    .concat(fs.readdirSync(root).filter((f) => fs.statSync(path.join(root, f)).isFile()));
}
export const scriptKind = (ts, rel) => (rel.endsWith('x') && !rel.endsWith('.mjs') ? ts.ScriptKind.TSX : rel.endsWith('.mjs') || rel.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS);

// `files` (every scanned path) rides along for sliceFacts; the CLI drops it from facts.json.
export function extractFacts({ root = process.cwd(), typescript } = {}) {
  const ROOT = root;
  const ts = typescript ?? createRequire(ROOT + '/package.json')('typescript');
  const all = listFiles(ROOT);
  const isCode = (f) => /\.(ts|tsx|mts|mjs|js|jsx)$/.test(f);
  const isTest = (f) => /\.test\.|\.spec\./.test(f);

  // ---- parsing helpers
  const cache = new Map();
  function parse(rel) {
    if (cache.has(rel)) return cache.get(rel);
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKind(ts, rel));
    cache.set(rel, sf);
    return sf;
  }
  const line = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const loc = (sf, n) => `${sf.fileName}:${line(sf, n)}`;
  function visit(n, fn) { fn(n); ts.forEachChild(n, (c) => visit(c, fn)); }

  function topConsts(sf) {
    const m = new Map();
    for (const st of sf.statements) if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) m.set(d.name.text, d.initializer);
    return m;
  }
  // resolve expression to a string with [param] placeholders; null if nothing resolvable
  function resolve(e, consts, depth = 0) {
    if (!e || depth > 4) return null;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return { v: e.text, raw: e.text };
    if (ts.isTemplateExpression(e)) {
      let v = e.head.text, raw = e.head.text;
      for (const s of e.templateSpans) {
        const sub = ts.isIdentifier(s.expression) && consts.has(s.expression.text) ? resolve(s.expression, consts, depth + 1) : null;
        v += (sub ? sub.v : '[param]') + s.literal.text;
        raw += '${' + s.expression.getText() + '}' + s.literal.text;
      }
      return { v, raw };
    }
    if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e)) return resolve(e.expression, consts, depth + 1);
    if (ts.isIdentifier(e) && consts.has(e.text)) return resolve(consts.get(e.text), consts, depth + 1);
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const a = resolve(e.left, consts, depth + 1) ?? { v: '[param]', raw: '${' + e.left.getText() + '}' };
      const b = resolve(e.right, consts, depth + 1) ?? { v: '[param]', raw: '${' + e.right.getText() + '}' };
      return { v: a.v + b.v, raw: a.raw + b.raw };
    }
    return null;
  }
  const stripQ = (s) => s.split(/[?#]/)[0];

  // ---- 1. routes
  const routeFiles = all.filter((f) => /^app\/api\/.*\/route\.ts$/.test(f));
  const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'];
  const routes = routeFiles.map((file) => {
    const sf = parse(file);
    const methods = [], imports = [];
    for (const st of sf.statements) {
      if (ts.isImportDeclaration(st)) {
        const s = st.moduleSpecifier.text;
        if (s.startsWith('@/lib') || s.startsWith('.')) imports.push(s);
      }
      const exported = ts.canHaveModifiers(st) && ts.getModifiers(st)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) continue;
      if (ts.isFunctionDeclaration(st) && st.name && METHODS.includes(st.name.text)) methods.push(st.name.text);
      if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && METHODS.includes(d.name.text)) methods.push(d.name.text);
    }
    const url = '/' + path.dirname(file).replace(/^app\//, '');
    return { file, path: url, methods, imports };
  });

  // ---- 2. client calls
  const clientFiles = all.filter((f) => isCode(f) && !isTest(f) && ((f.startsWith('app/') && !f.startsWith('app/api/')) || f.startsWith('lib/')));
  const clientCalls = [];
  for (const file of clientFiles) {
    const sf = parse(file), consts = topConsts(sf);
    visit(sf, (n) => {
      const isFetch = ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'fetch';
      const isWs = ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'WebSocket';
      if (!isFetch && !isWs) return;
      const arg = n.arguments?.[0];
      const r = resolve(arg, consts);
      const c = { at: loc(sf, n), kind: isWs ? 'ws' : 'fetch', argText: arg?.getText().slice(0, 160) };
      if (r) { c.url = r.v; c.raw = r.raw; }
      // URL must contain /api/ somewhere to be considered resolved
      const i = r ? r.v.indexOf('/api/') : -1;
      if (i >= 0) c.path = stripQ(r.v.slice(i)); else c.unresolved = true;
      if (isWs) c.method = 'WS';
      else {
        c.method = 'GET';
        const opt = n.arguments[1];
        if (opt && ts.isObjectLiteralExpression(opt)) {
          const p = opt.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'method');
          if (p) { const m = resolve(p.initializer, consts); if (m) c.method = m.v.toUpperCase(); else { c.method = null; c.methodExpr = p.initializer.getText(); } }
          else if (opt.properties.some(ts.isSpreadAssignment)) c.methodNote = 'options has spread';
        } else if (opt) c.methodNote = 'options not literal: ' + opt.getText().slice(0, 60);
      }
      clientCalls.push(c);
    });
  }

  // ---- 3. wsPaths
  const wsPaths = [];
  for (const file of all.filter((f) => /^server\/[^/]*\.mts$/.test(f) && !isTest(f))) {
    const sf = parse(file);
    const names = new Map();
    for (const st of sf.statements) if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations)
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isStringLiteral(d.initializer) || ts.isNoSubstitutionTemplateLiteral(d.initializer)) && d.initializer.text.startsWith('/api/'))
          names.set(d.name.text, { name: d.name.text, value: d.initializer.text, at: loc(sf, d), usedAt: [] });
    visit(sf, (n) => {
      if (ts.isIdentifier(n) && names.has(n.text) && !(ts.isVariableDeclaration(n.parent) && n.parent.name === n)) {
        let s = n; while (s.parent && !ts.isStatement(s)) s = s.parent;
        names.get(n.text).usedAt.push({ at: loc(sf, n), stmt: s.getText().split('\n')[0].slice(0, 140) });
      }
    });
    wsPaths.push(...names.values());
  }

  // ---- 4. yorkie
  const yorkie = [];
  const CALLEE = [
    [/^new yorkie\.Client$/, 'new yorkie.Client'], [/\.attach$/, 'attach'], [/\.detach$/, 'detach'],
    [/doc\w*\.update$/i, 'doc.update'], [/doc\w*\.subscribe$/i, 'doc.subscribe'],
    [/createRevision$/, 'createRevision'], [/listRevisions$/, 'listRevisions'], [/getRevision$/, 'getRevision'], [/restoreRevision$/, 'restoreRevision'],
    [/client\w*\.sync$/i, 'client.sync'],
  ];
  for (const file of all.filter((f) => isCode(f) && !isTest(f))) {
    const sf = parse(file);
    visit(sf, (n) => {
      if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
        const t = (ts.isNewExpression(n) ? 'new ' : '') + n.expression.getText().replace(/\s+/g, '');
        for (const [re, tag] of CALLEE) if (re.test(t)) { yorkie.push({ at: loc(sf, n), tag, callee: t }); break; }
      }
      if (file.startsWith('lib/') && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text.includes('AdminService/'))
        yorkie.push({ at: loc(sf, n), tag: 'AdminService', callee: n.text });
    });
  }

  // ---- 5. env
  const envVars = [];
  for (const file of all.filter((f) => isCode(f) && /^(app|lib|server|scripts)\//.test(f) || f === 'instrumentation.ts' || f === 'next.config.ts')) {
    const sf = parse(file);
    visit(sf, (n) => {
      if (ts.isPropertyAccessExpression(n) && n.expression.getText() === 'process.env') envVars.push({ name: n.name.text, at: loc(sf, n), test: isTest(file) });
      else if (ts.isElementAccessExpression(n) && n.expression.getText() === 'process.env' && ts.isStringLiteral(n.argumentExpression)) envVars.push({ name: n.argumentExpression.text, at: loc(sf, n), test: isTest(file) });
      else if (ts.isVariableDeclaration(n) && n.initializer?.getText() === 'process.env' && ts.isObjectBindingPattern(n.name))
        for (const el of n.name.elements) envVars.push({ name: (el.propertyName ?? el.name).getText(), at: loc(sf, n), test: isTest(file), destructured: true });
    });
  }

  // ---- 6. matching
  const norm = (p) => stripQ(p).split('/').filter(Boolean).map((s) => (/^\[.*\]$/.test(s) ? '[param]' : s));
  const same = (a, b) => a.length === b.length && a.every((s, i) => s === b[i] || s === '[param]' || b[i] === '[param]');
  const wsVals = wsPaths.map((w) => w.value);
  const matchingCalls = clientCalls.map((c) => {
    if (!c.path) return { at: c.at, unresolved: true, route: null };
    const hits = routes.filter((r) => same(norm(c.path), norm(r.path)));
    const ws = c.kind === 'ws' ? wsVals.includes(c.path) : undefined;
    return {
      at: c.at, kind: c.kind, method: c.method, path: c.path,
      route: hits[0]?.file ?? null, methodOk: hits[0] ? (c.kind === 'ws' ? null : hits[0].methods.includes(c.method)) : null,
      ...(ws !== undefined && { wsPathDeclared: ws }),
    };
  });
  const called = new Set(matchingCalls.map((m) => m.route).filter(Boolean));
  const matching = { calls: matchingCalls, routesWithNoClientCaller: routes.filter((r) => !called.has(r.file)).map((r) => ({ file: r.file, path: r.path, methods: r.methods })) };

  // ---- infra
  const infra = {};
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  infra.packageScripts = pkg.scripts;
  infra.engines = pkg.engines; infra.packageManager = pkg.packageManager;
  const rd = (f) => (fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : null);
  infra.dockerfile = (rd('Dockerfile') ?? '').split('\n').map((l, i) => ({ n: i + 1, l })).filter((x) => /^\s*(FROM|EXPOSE|CMD|ENTRYPOINT|ENV|ARG|USER|HEALTHCHECK|WORKDIR|RUN|COPY)\b/i.test(x.l)).map((x) => `${x.n}: ${x.l.trim().slice(0, 200)}`);
  infra.dockerCompose = (rd('docker-compose.yml') ?? '').split('\n').map((l, i) => `${i + 1}: ${l}`).filter((l) => !/^\d+:\s*(#|$)/.test(l));
  infra.nextConfig = (rd('next.config.ts') ?? '').split('\n').slice(0, 120).join('\n');
  infra.vitestConfig = (rd('vitest.config.mts') ?? '').split('\n').slice(0, 120).join('\n');
  function yamlBlock(lines, i, indent) { // lines after key until a line with indent <= indent
    const out = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j]; if (!l.trim() || l.trim().startsWith('#')) continue;
      if (l.match(/^ */)[0].length <= indent) break;
      out.push(l.trim());
    }
    return out;
  }
  infra.workflows = all.filter((f) => /^\.github\/workflows\/.*\.ya?ml$/.test(f)).map((file) => {
    const lines = rd(file).split('\n');
    const w = { file, jobs: [] };
    let inJobs = false;
    lines.forEach((l, i) => {
      let m;
      if ((m = l.match(/^name:\s*(.*)/))) w.name = m[1];
      if (/^on:/.test(l)) w.on = l.trim() === 'on:' ? yamlBlock(lines, i, 0) : l.trim();
      if (/^permissions:/.test(l)) w.permissions = l.trim() === 'permissions:' ? yamlBlock(lines, i, 0) : l.trim();
      if (/^jobs:/.test(l)) inJobs = true;
      else if (/^\S/.test(l) && !/^\s*#/.test(l)) inJobs = false;
      if (inJobs && (m = l.match(/^  ([\w-]+):\s*$/))) w.jobs.push({ id: m[1], line: i + 1 });
      const job = w.jobs[w.jobs.length - 1];
      if (inJobs && job) {
        if ((m = l.match(/^    name:\s*(.*)/))) job.name = m[1];
        if ((m = l.match(/^    needs:\s*(.*)/))) job.needs = m[1];
        if ((m = l.match(/^    if:\s*(.*)/))) job.if = m[1];
        if ((m = l.match(/^    runs-on:\s*(.*)/))) job.runsOn = m[1];
        if (/^    permissions:/.test(l)) job.permissions = l.trim() === 'permissions:' ? yamlBlock(lines, i, 4) : l.trim();
      }
    });
    return w;
  });

  return { routes, clientCalls, wsPaths, yorkie, envVars, matching, infra, files: all };
}

// Not path.matchesGlob: Next paths contain `[id]`, which it reads as a character class, so an
// exact claimed path would not even match itself. This escapes brackets and keeps * / **.
export const gl = (g) => new RegExp('^' + g.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\*\*\/(?!$)/g, '\u0000').replace(/\*\*$/, '\u0001').replace(/\*/g, '[^/]*').replace(/\u0000/g, '(.*/)?').replace(/\u0001/g, '.*') + '$');

// parts: derive-parts output ({part:{docs,code}}) or a plain {part:[code globs]}; a claimed
// directory counts as dir/**. Returns { <part>: slice } of facts.
export function sliceFacts(facts, parts) {
  const { routes, clientCalls, wsPaths, yorkie, envVars, matching, infra, files: all } = facts;
  const PARTS = Object.fromEntries(Object.entries(parts).filter(([k]) => k !== '_unowned')
    .map(([k, v]) => [k, (Array.isArray(v) ? v : v.code).map((g) => (g.endsWith('/') ? g + '**' : g))]));
  const slices = {};
  for (const [part, globs] of Object.entries(PARTS)) {
    const res = globs.map(gl);
    const inPart = (f) => res.some((r) => r.test(f));
    const at = (s) => s.replace(/:\d+$/, '');
    slices[part] = {
      files: all.filter(inPart),
      routes: routes.filter((r) => inPart(r.file)),
      clientCalls: clientCalls.filter((c) => inPart(at(c.at))),
      wsPaths: wsPaths.filter((w) => inPart(at(w.at))),
      yorkie: yorkie.filter((y) => inPart(at(y.at))),
      envVars: envVars.filter((e) => inPart(at(e.at))),
      matching: {
        calls: matching.calls.filter((m) => inPart(at(m.at))),
        routesWithNoClientCaller: matching.routesWithNoClientCaller.filter((r) => inPart(r.file)),
      },
      ...(part === 'infra' && { infra }),
    };
  }
  return slices;
}
