import { randomUUID } from "node:crypto";

/** Short-lived tokens the browser hands to Yorkie (NFR-SEC-002/005).
 *  **Deliberately not the session** — the cookie is `httpOnly`, so page scripts
 *  cannot pass it to `authTokenInjector` and must pass something narrower.
 *  Why the webhook needs it and why these stay in memory: `docs/design/api.md`. */

/** An hour. Why not shorter, and why expiry costs the person nothing:
 *  `docs/design/api.md`. A server restart clears `sessionByToken` outright, TTL
 *  or not; what rides out a token's remaining life is a page reload. */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/** The host's token stands for the bootstrap secret under this prefix — **not
 *  re-checked against it**, since only the token route writes this registry and
 *  it already matched the secret before issuing. A restart clears the secret and
 *  the registry together, which is what invalidates the host's tokens too. */
export const HOST_SESSION_PREFIX = "host:";

export class YorkieTokenRegistry {
  private readonly sessionByToken = new Map<
    string,
    { sessionId: string; expiresAt: number }
  >();

  /** `now` is injectable so expiry is testable; nothing in production passes it. */
  issue(sessionId: string, now = Date.now()): string {
    // Pruned at issue time, not on a timer (api.md).
    let existing: string | undefined;

    for (const [token, entry] of this.sessionByToken) {
      if (entry.expiresAt <= now) {
        this.sessionByToken.delete(token);
      } else if (entry.sessionId === sessionId) {
        existing = token;
      }
    }

    // Reuse is what bounds this map — see api.md, "already holds a live token".
    if (existing) return existing;

    const token = randomUUID();
    this.sessionByToken.set(token, { sessionId, expiresAt: now + TOKEN_TTL_MS });

    return token;
  }

  /** The session a token stands for, or null. Whether that session is still
   *  *live* is `sessionRegistry`'s question, deliberately not this one. */
  resolve(token: string | undefined, now = Date.now()): string | null {
    if (!token) return null;

    const entry = this.sessionByToken.get(token);
    if (!entry) return null;

    if (entry.expiresAt <= now) {
      this.sessionByToken.delete(token);
      return null;
    }

    return entry.sessionId;
  }
}

// On `globalThis` for the same reason as `session-registry.ts`: this module is
// loaded twice in one process, and two registries would mean a token issued on
// one side never resolving on the other.
const cache = globalThis as { __yorkieTokenRegistry?: YorkieTokenRegistry };

export const yorkieTokenRegistry = (cache.__yorkieTokenRegistry ??=
  new YorkieTokenRegistry());
