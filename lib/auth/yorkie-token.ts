import { randomUUID } from "node:crypto";

/**
 * Short-lived tokens the browser hands to Yorkie (NFR-SEC-002/005).
 *
 * **This is deliberately not the session.** The session cookie is `httpOnly`,
 * so page scripts cannot pass it to `authTokenInjector` even though they must
 * pass something; this is that something — narrower and short-lived.
 *
 * Why the webhook needs it at all, what a token points at, and why these stay
 * in memory: `docs/design/api.md`, "Authentication model".
 */

/**
 * An hour. Expiry costs the person nothing — measured against SDK 0.7.13, a
 * refused token makes `authTokenInjector` fire again and the operation retries
 * through. Not shorter because refreshing needs this server, and a browser
 * that reloads the page rides that out on its still-valid token, as long as
 * this server process itself has not restarted — a server restart clears
 * `sessionByToken` outright, TTL or not.
 */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/** The host has no guest session, so their token stands for the bootstrap
 *  secret under this prefix — not re-checked against it, since only the
 *  token route writes this registry and it already matched that secret
 *  before issuing (`app/api/internal/yorkie/auth/route.ts`). A restart clears
 *  both the secret and this registry together, which is what invalidates the
 *  host's tokens too. */
export const HOST_SESSION_PREFIX = "host:";

export class YorkieTokenRegistry {
  private readonly sessionByToken = new Map<
    string,
    { sessionId: string; expiresAt: number }
  >();

  /** `now` is injectable so expiry is testable; nothing in production passes it. */
  issue(sessionId: string, now = Date.now()): string {
    // Expired entries are cleared here rather than on a timer: issuing is the
    // only moment the map grows, so it is the only moment it needs pruning, and
    // a timer would be a second thing to keep alive for no gain.
    let existing: string | undefined;

    for (const [token, entry] of this.sessionByToken) {
      if (entry.expiresAt <= now) {
        this.sessionByToken.delete(token);
      } else if (entry.sessionId === sessionId) {
        existing = token;
      }
    }

    // A session that already holds a live token gets that one back. Minting a
    // fresh token per call would let the map grow without bound for an hour:
    // `authTokenInjector` runs on *every* refusal, so a session whose requests
    // keep being refused — a clock skew, a webhook fault — would fetch in a loop
    // and each fetch would leave another entry behind. `SessionRegistry` guards
    // the same shape with a `MAX_MEMBERS` ceiling; here the bound falls out for
    // free, because there is no reason for one session to hold two.
    //
    // Two tabs therefore share a token, which is right: the token authorizes a
    // session, and both tabs are that session. Handing back one with only
    // minutes left is fine too — the SDK asks for a replacement the moment the
    // webhook refuses it.
    if (existing) return existing;

    const token = randomUUID();
    this.sessionByToken.set(token, { sessionId, expiresAt: now + TOKEN_TTL_MS });

    return token;
  }

  /**
   * The session a token stands for, or null once it has expired or was never
   * issued. Whether that session is still *live* is the caller's question —
   * `sessionRegistry` owns that, and keeping it out of here is what lets this
   * be tested without one.
   */
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

// Cached on `globalThis` for the same reason as `lib/auth/session-registry.ts`:
// this module is loaded twice in one process — once through Next's bundled
// graph and once by Node's native loader — and two private registries would mean
// a token issued on one side never resolving on the other.
const cache = globalThis as { __yorkieTokenRegistry?: YorkieTokenRegistry };

export const yorkieTokenRegistry = (cache.__yorkieTokenRegistry ??=
  new YorkieTokenRegistry());
