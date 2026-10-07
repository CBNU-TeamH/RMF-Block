import type { WorkspaceMember } from "../auth/types.ts";
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

export type RosterEntry = { member: WorkspaceMember; online: boolean; presence?: WorkspacePresence };

/** Everyone the workspace has recorded, connected or not (FR-040-04). Online
 *  members come first, the viewer first among them; a connected member the
 *  stored list has not seen yet (joined since the layout rendered) is still
 *  listed. */
export function withOffline(
  connected: Array<WorkspacePresence>,
  known: Array<WorkspaceMember>,
  memberId: string,
): Array<RosterEntry> {
  const online = connected
    .map((presence): RosterEntry => ({ member: presence, online: true, presence }))
    .sort((a, b) => Number(b.member.id === memberId) - Number(a.member.id === memberId));
  const here = new Set(connected.map((m) => m.id));
  const offline = known
    .filter((m) => !here.has(m.id))
    .map((member): RosterEntry => ({ member, online: false }));

  return [...online, ...offline];
}

/** Members per document, for the tree's tags (UC-040). */
export function occupantsByDocument(
  connected: Array<WorkspacePresence>,
): Map<string, Array<WorkspacePresence>> {
  const byDocument = new Map<string, Array<WorkspacePresence>>();
  for (const member of connected) {
    const documentId = member.location?.documentId;
    if (!documentId) continue;
    byDocument.set(documentId, [...(byDocument.get(documentId) ?? []), member]);
  }
  return byDocument;
}
