import { isHostSecret } from "../host-secret.ts";
import { sessionRegistry } from "./session-registry.ts";
import { SESSION_COOKIE } from "./types.ts";

/**
 * Pulls one named cookie's value out of a raw `Cookie:` header.
 *
 * Route handlers get `cookies()` from Next, but the WebSocket upgrade in
 * `server/index.mts` never reaches Next — it sees the bare Node request, so it
 * has to read the header itself.
 */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;

  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;

    if (pair.slice(0, separator).trim() !== name) continue;

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

export function readSessionCookie(header: string | undefined): string | null {
  return readCookie(header, SESSION_COOKIE);
}

/**
 * Whether a session already resolved from the same header (or the header's
 * own `role` cookie) proves a live session or the host — the gate
 * `server/index.mts` applies before ever registering a WebSocket connection.
 * Mirrors `currentMember()`'s two-branch check for a context with no Next
 * `cookies()` jar (the WS upgrade request never reaches Next).
 *
 * Takes `sessionId` already extracted rather than re-reading it from `header`:
 * `server/index.mts` needs that same value again to file the workspace socket
 * under it, and re-parsing the header a second time for the identical cookie
 * would cost that on every upgrade for nothing.
 */
export function isAuthenticatedSocket(sessionId: string | null, header: string | undefined): boolean {
  if (sessionRegistry.resolve(sessionId ?? undefined)) return true;
  return isHostSecret(readCookie(header, "role") ?? undefined);
}
