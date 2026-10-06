# A Playwright E2E layer and the IME replay race — lessons

**Created**: 2026-10-05

Written while building, not after. Keep entries short and concrete — the point is
that the next person does not rediscover this.

## What surprised us

- #52 was exactly as traced from the code. Measured end to end before the fix: A composes 안 after `abc` while B types X at the start; A's screen ended on `Xabc안`, B's — what Yorkie holds — on `Xab안c`, and nothing ever reconciled them.
- The issue said #52 "needs a real browser", but the bug was in *our* offsets (a baseline copied from the DOM, a replay in Yorkie's coordinates against the DOM's text), so a component test with a real `yorkie.Document` behind the block reproduces it in milliseconds. The E2E run is what proves the fix holds under a real composition; the component test is what keeps it fixed.
- A false red after the fix: `pnpm dev` on the `/mnt/c` checkout kept serving the old `text-block.tsx` (its log showed "Ecmascript file had an error" from a moment the file was swapped). Restarting it turned the run green.
- `pnpm dev` rewrites `tsconfig.json` (adds `.next-dev/types` paths and reflows arrays) every time it starts. It has to be reverted before committing.

## What we would do differently

- Write the component test for an IME bug first, even when the issue says "browser only" — trace whether the offsets are ours before reaching for the heavy layer.

## Worth extracting

Things that should become a convention, a helper, or a line in `AGENTS.md`.

- Already in `docs/testing.md` "E2E": restart `pnpm dev` before trusting an E2E run after editing a client component on `/mnt/c`.
- Open: stop `pnpm dev` rewriting `tsconfig.json` — either commit the `.next-dev/types` include it wants, or note it in `docs/conventions.md` beside the `distDir` section.
