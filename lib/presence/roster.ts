import type { WorkspacePresence } from "./types.ts";

/** Yorkie's clients folded into the members a person should see — why they are
 *  not the same thing: `docs/design/presence-and-focus.md`. */
export function rosterFrom(
  presences: Array<{ presence: WorkspacePresence }>,
): Array<WorkspacePresence> {
  const byId = new Map<string, WorkspacePresence>();

  for (const { presence } of presences) {
    // Not hardening — attaching needs a session token (api.md §2); this only
    // keeps an id-less entry from collapsing into one blank row.
    if (!presence?.id) continue;

    byId.set(presence.id, presence);
  }

  return [...byId.values()];
}
