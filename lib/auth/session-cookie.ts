import { SESSION_COOKIE } from "./types.ts";

/**
 * Pulls the session id out of a raw `Cookie:` header.
 *
 * Route handlers get `cookies()` from Next, but the WebSocket upgrade in
 * `server/index.mts` never reaches Next — it sees the bare Node request, so it
 * has to read the header itself.
 */
export function readSessionCookie(header: string | undefined): string | null {
  if (!header) return null;

  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;

    if (pair.slice(0, separator).trim() !== SESSION_COOKIE) continue;

    // Only the first `=` separates name from value — a base64 value can contain
    // more, so splitting on every `=` would truncate it.
    const value = pair.slice(separator + 1).trim();
    if (value === "") return null;

    try {
      return decodeURIComponent(value);
    } catch {
      // `decodeURIComponent` throws on a malformed escape such as a bare `%`,
      // and this runs inside `server/index.mts`'s `upgrade` handler, where an
      // uncaught throw takes the whole process down — Next included, since it
      // is one process. A header nobody could have issued is not a session.
      return null;
    }
  }

  return null;
}
