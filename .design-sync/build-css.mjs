// Compiles app/globals.css through the repo's own Tailwind v4 PostCSS plugin
// into a static stylesheet for design-sync's cssEntry (Next does this at build
// time; the sync needs it standalone). Tailwind scans the repo for classes,
// including .design-sync/previews/.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const twPath = require.resolve('@tailwindcss/postcss');
const postcss = createRequire(twPath)('postcss');
const tailwind = require('@tailwindcss/postcss');
const from = 'app/globals.css';
const out = '.design-sync/.cache/app.css';
// The design agent's own markup is never scanned, so ship the token colours and
// a basic layout vocabulary regardless of whether the app uses them yet.
// ponytail: a fixed safelist; widen it when conventions.md names more.
const safelist = [
  '{hover:,}{bg,text,border}-{ink,ink-soft,ink-faint,paper,paper-2,shell,sky,sky-deep,sky-soft}',
  '{flex,inline-flex,grid,block,hidden,flex-col,flex-row,flex-1,flex-wrap,items-center,items-start,items-end,justify-between,justify-center,justify-end}',
  '{gap,p,px,py,m,mx,my,mt,mb}-{0,1,1.5,2,2.5,3,4,5,6,8,10,12}',
  '{text-xs,text-sm,text-base,text-lg,text-xl,text-2xl,font-medium,font-semibold,font-bold,font-mono,truncate,uppercase,tracking-wide}',
  '{rounded,rounded-md,rounded-lg,rounded-full,border,border-t,border-b,shadow,shadow-lg,w-full,h-full,min-h-screen}',
].map((s) => `@source inline("${s}");`).join('\n');
const css = readFileSync(from, 'utf8').replace('@import "tailwindcss";', `@import "tailwindcss";\n${safelist}`);
const result = await postcss([tailwind({ base: process.cwd() })]).process(css, { from });
mkdirSync('.design-sync/.cache', { recursive: true });
writeFileSync(out, result.css);
console.log(`wrote ${out} (${result.css.length} bytes)`);
