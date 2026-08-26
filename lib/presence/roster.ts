import type { WorkspacePresence } from "./types.ts";

/**
 * Turns what Yorkie reports into the list a person should see.
 *
 * The two are not the same thing. Yorkie counts *clients*, and one member can
 * hold several at once — two browser tabs, or the moment during a takeover
 * (FR-020-08) when the displaced device has not finished detaching. Measured
 * against a real server, a member with two tabs open appears twice in
 * `getPresences()`, so collapsing them is what the roster is for, not a
 * precaution.
 *
 * Kept out of the component so it can be tested without a browser or a running
 * Yorkie. The argument is shaped like `doc.getPresences()` so the caller can
 * hand its result straight over.
 */
export function rosterFrom(
  presences: Array<{ presence: WorkspacePresence }>,
): Array<WorkspacePresence> {
  const byId = new Map<string, WorkspacePresence>();

  for (const { presence } of presences) {
    // Anything without an id cannot be told apart from anything else without
    // one, and `undefined` as a Map key would collapse every such entry into a
    // single blank row. Skipping is not hypothetical hardening: Yorkie runs
    // with no auth webhook today (`docs/design/api.md` §2), and Phase 1 will
    // have clients attaching with presence shapes of their own.
    if (!presence?.id) continue;

    byId.set(presence.id, presence);
  }

  return [...byId.values()];
}
