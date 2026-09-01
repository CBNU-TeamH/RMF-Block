/**
 * `/documents/abc-123` → `"abc-123"`; anything else (the document list,
 * `/join`, …) → `null`.
 *
 * Pulled out of `focus-follow-provider.tsx` so it can be unit-tested: that
 * file is a client component (`"use client"`, JSX), which Node's own test
 * runner cannot import directly the way it imports a plain `.ts` module.
 */
export function documentIdFromPathname(pathname: string): string | null {
  return pathname.match(/^\/documents\/([^/]+)/)?.[1] ?? null;
}
