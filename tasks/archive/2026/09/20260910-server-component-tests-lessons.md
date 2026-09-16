# Server-component Tier 1 tests — lessons

**Created**: 2026-09-10

## What surprised us

- `render()` from `@testing-library/react` turned out not to be the right tool for three of the
  four cases — the Next Vitest guide's own example only ever renders a *synchronous* component,
  never `await Page(props)`. `redirect()`/`notFound()` really `throw` (confirmed in
  `node_modules/next/dist/client/components/redirect.js`/`not-found.js`), so those three tests
  are `assert.rejects` on the direct call, no DOM, no `happy-dom` pragma — cheaper than the
  client-component tier, not more expensive, despite server components sounding harder to test.
- Issue #66's "FR-020-03/04 auth gate" shorthand was imprecise: FR-020-03 (the password check) is
  enforced upstream in `/api/auth/*`; `app/(workspace)/layout.tsx` only implements FR-020-04's
  absence-of-session gate. Caught by reading `docs/SRS-ko.md`'s actual FR text instead of reusing
  the issue's own paraphrase.
- Unlike the client-component tier's focus-restoration test, temporarily breaking the auth gate
  locally (flipping `&&` to `||`) and re-running failed cleanly and fast — no hang. The earlier
  hang was specific to a component with in-flight async state (a pending fetch, a dialog effect
  chain); these tests have no polling and no async gap between the mocked call and the assertion,
  which seems to be the actual difference, not something about server vs. client components.

## What we would do differently

- ...

## Worth extracting

- ...
