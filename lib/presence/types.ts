import type { WorkspaceMember } from "../auth/types.ts";
import type { BlockId } from "../blocks/types.ts";

/** The connected-user list (FR-020-06/07). Why it rides Yorkie and not the WS
 *  hub: `docs/design/presence-and-focus.md`. */

/** Attached to purely to be counted present. A Yorkie key may only contain
 *  `a-z A-Z 0-9 - . _ ~`, so this cannot take a `:` without breaking attach. */
export const WORKSPACE_DOC_KEY = "workspace";

/** What each client publishes about itself (FR-020-08 for the colour tag). */
export type WorkspacePresence = WorkspaceMember & {
  /** Set while this member is sharing their view. `null`, never `undefined`, to
   *  end one — the SDK `JSON.stringify`s presence and `undefined` is dropped. */
  presenting?: {
    documentId: string;
    blockId: BlockId;
    ratio: number;
  } | null;
  /** Where this member is (FR-040-01): the document they have open and the
   *  block they last focused in it. Not cleared on blur, so a jump to someone
   *  who clicked away still lands where they were working. `null`, never
   *  `undefined`, for "not in a document", for the same reason as `presenting`. */
  location?: { documentId: string; blockId: BlockId | null } | null;
};

/** The host has no session to mint a `WorkspaceMember` from (UC-011). */
export const HOST_PRESENCE: WorkspacePresence = {
  id: "host",
  nickname: "Host",
  colorTag: "#64748b",
};
