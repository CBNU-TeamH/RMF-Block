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
  '{hover:,}{bg,text,border}-{ink,ink-soft,ink-faint,paper,paper-2,shell,sky,sky-deep,sky-soft,elev,line,line-strong,hover,sky-text,sky-ring,danger,danger-soft,scrim}',
  '{rounded-control,rounded-card,shadow-elev,font-sans}',
  '{flex,inline-flex,grid,block,hidden,flex-col,flex-row,flex-1,flex-wrap,items-center,items-start,items-end,justify-between,justify-center,justify-end}',
  '{gap,p,px,py,m,mx,my,mt,mb}-{0,1,1.5,2,2.5,3,4,5,6,8,10,12}',
  '{text-xs,text-sm,text-base,text-lg,text-xl,text-2xl,font-medium,font-semibold,font-bold,font-mono,truncate,uppercase,tracking-wide}',
  '{rounded,rounded-md,rounded-lg,rounded-full,border,border-t,border-b,shadow,shadow-lg,w-full,h-full,min-h-screen}',
].map((s) => `@source inline("${s}");`).join('\n');
const css = readFileSync(from, 'utf8').replace('@import "tailwindcss";', `@import "tailwindcss";\n${safelist}`);
const result = await postcss([tailwind({ base: process.cwd() })]).process(css, { from });
// Tailwind's own variables (utility internals, default theme values) aren't
// design tokens; mark them so Claude Design doesn't list them as unclassified
// (docs/ui/redesign/HANDOFF.md §1). After the build - Tailwind drops comments.
const marked = result.css.replace(
  /(--(?:tw-[\w-]+|ease-[\w-]+|default-transition-[\w-]+)\s*:[^;{}]*;)/g,
  '$1 /* @kind other */',
);
// next/font sets --font-pretendard on <html> in the app; the design system has
// no such class, so name the family .design-sync/pretendard.css ships.
const withFont = `${marked}\n:root { --font-pretendard: "Pretendard Variable"; }\n`;
mkdirSync('.design-sync/.cache', { recursive: true });
writeFileSync(out, withFont);
console.log(`wrote ${out} (${withFont.length} bytes)`);
