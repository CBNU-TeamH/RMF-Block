import { randomUUID } from "node:crypto";

/**
 * Short-lived tokens the browser hands to Yorkie (NFR-SEC-002/005).
 *
 * Yorkie asks this server whether a token may act, through the auth webhook, so
 * a client that cannot show one never gets past `ActivateClient` — which is the
 * hole `docs/design/api.md` §2 names: port 8080 is on the LAN, and the session
 * cookie only ever gated the Next.js routes.
 *
 * **This is not the session, and that is the point.** The session cookie is
 * `httpOnly` on purpose — a token in reach of page scripts is a token that can
 * be read off a shared screen (UC-030) — so client JS cannot pass it to
 * `authTokenInjector` even though it needs to pass *something*. This is that
 * something: narrower, because all it authorizes is Yorkie, and short-lived, so
 * a copy of it is worth less than a copy of the session it came from.
 *
 * A token points at a session rather than at a member, so revocation needs no
 * code here: the caller resolves the session afterwards, and a session displaced
 * by another device (FR-020-08) or lost to a restart takes its tokens with it.
 *
 * In memory, like the sessions it points at. A bearer token on the host's disk
 * outlives the reason it was issued. Issue #47 weighs this against a signed
 * token that the webhook could verify without a table.
 */

/**
 * An hour. The lifetime only decides how often the browser fetches a new one,
 * because the SDK asks for a replacement whenever the webhook refuses — measured
 * against 0.7.13, `authTokenInjector` is called again with the refusal's reason
 * and the retried operation goes through. So the cost of a short life is not
 * felt by the person using it; what it does buy is a smaller window in which a
 * leaked token is worth anything.
 *
 * Not shorter, because refreshing means reaching this server: an app-server
 * restart is invisible to an editing browser only while its current token
 * lasts. An hour keeps that window wide enough to ride out a restart and narrow
 * enough that a token found later is almost certainly dead.
 */
const TOKEN_TTL_MS = 60 * 60 * 1000;

export class YorkieTokenRegistry {
  private readonly sessionByToken = new Map<
    string,
    { sessionId: string; expiresAt: number }
  >();

  /**
   * `now` is injectable so expiry is testable without waiting an hour. Nothing
   * in production passes it.
   */
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
