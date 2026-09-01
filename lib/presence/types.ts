import type { WorkspaceMember } from "../auth/types.ts";
import type { BlockId } from "../blocks/types.ts";

/**
 * The contract for the connected-user list (FR-020-06/07).
 *
 * Presence rides Yorkie rather than the WS hub. Yorkie already answers "who is
 * attached right now" — including the hard half, noticing that someone stopped
 * being attached — so the roster is read off the document instead of being
 * bookkept by us. See this task's todo for why the hub was not used.
 */

/**
 * The one document every client in the workspace attaches to, purely to be
 * counted present. Yorkie presence is per-document, so a workspace-wide roster
 * needs a workspace-wide document to hang it on.
 *
 * A reserved literal key rather than an id, the same shape `docs/design/api.md`
 * §2 already gives the `chat` singleton — real documents get their id as their
 * key, and both singletons predate any id to use. Legal as a Yorkie key: only
 * `a-z A-Z 0-9 - . _ ~` are allowed, and this is nine lowercase letters.
 *
 * It carries no content of its own and is never edited. That is not a waste —
 * an empty document is the cheapest thing Yorkie will let you be present on.
 */
export const WORKSPACE_DOC_KEY = "workspace";

/**
 * What each client publishes about itself. Deliberately the same
 * `WorkspaceMember` the session registry mints at join: the color tag shown in
 * the roster has to be the one FR-020-08 promises stays yours across devices,
 * and a second identity type would be a second chance to disagree about it.
 */
export type WorkspacePresence = WorkspaceMember & {
  /** Set while this member is presenting (sharing their view); `null` (not
   * `undefined`) ends the share — see why in this task's todo, "the SDK
   * `JSON.stringify`s each presence value, and `undefined` doesn't survive
   * that round trip." Absent entirely for a member who has never presented. */
  presenting?: {
    documentId: string;
    blockId: BlockId;
    ratio: number;
  } | null;
};

/**
 * The host has no session and no nickname — identity comes from having started
 * the container (`lib/host-secret.ts`), not from the join form — so there is no
 * `WorkspaceMember` to publish. Without this the host would be the one person
 * missing from the list they are supposed to administer (UC-011 kicks guests
 * from exactly this roster).
 *
 * A fixed id, where guests get `randomUUID()`: one host per container, and the
 * two spaces cannot collide. The color is a neutral gray on purpose — it must
 * not look like one of the eight rotating guest tags, and it has to stay visible
 * in both themes, which rules out the obvious near-black.
 */
export const HOST_PRESENCE: WorkspacePresence = {
  id: "host",
  nickname: "Host",
  colorTag: "#64748b",
};
