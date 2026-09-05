/** `/documents/abc-123` → `"abc-123"`, anything else → `null`. Lives here, not
 *  in `focus-follow-provider.tsx`, because Node's test runner cannot import a
 *  client component the way it imports a plain `.ts` module. */
export function documentIdFromPathname(pathname: string): string | null {
  return pathname.match(/^\/documents\/([^/]+)/)?.[1] ?? null;
}
