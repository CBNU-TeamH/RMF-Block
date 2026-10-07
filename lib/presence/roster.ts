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

/** `presence` is set exactly when the member is connected. */
export type RosterEntry = { member: WorkspaceMember; presence?: WorkspacePresence };

/** Who the header roster lists (FR-040-01/04): the viewer, then the others in
 *  `documentId` (`null` on a page with no document), then every recorded member
 *  who is not connected. The rest of the connected members are found in the
 *  document tree (`occupantsByDocument`). A connected member the stored list has
 *  not seen yet (joined since the layout rendered) still counts. */
export function withOffline(
  connected: Array<WorkspacePresence>,
  known: Array<WorkspaceMember>,
  memberId: string,
  documentId: string | null,
): Array<RosterEntry> {
  const online = connected
    .filter((m) => m.id === memberId || (documentId && m.location?.documentId === documentId))
    .map((presence): RosterEntry => ({ member: presence, presence }))
    .sort((a, b) => Number(b.member.id === memberId) - Number(a.member.id === memberId));
  const here = new Set(connected.map((m) => m.id));
  const offline = known
    .filter((m) => !here.has(m.id))
    .map((member): RosterEntry => ({ member }));

  return [...online, ...offline];
}

/** The *other* members in each document, for the tree's dots (UC-040). */
export function occupantsByDocument(
  connected: Array<WorkspacePresence>,
  exceptId: string,
): Map<string, Array<WorkspacePresence>> {
  const byDocument = new Map<string, Array<WorkspacePresence>>();
  for (const member of connected) {
    if (member.id === exceptId) continue;
    const documentId = member.location?.documentId;
    if (!documentId) continue;
    const list = byDocument.get(documentId);
    if (list) list.push(member);
    else byDocument.set(documentId, [member]);
  }
  return byDocument;
}
