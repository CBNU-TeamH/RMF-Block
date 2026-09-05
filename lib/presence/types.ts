import type { WorkspaceMember } from "../auth/types.ts";
import type { BlockId } from "../blocks/types.ts";

/**
 * The contract for the connected-user list (FR-020-06/07).
 *
 * Why presence rides Yorkie rather than the WS hub, and why the roster hangs off
 * a reserved singleton document: `docs/design/presence-and-focus.md`.
 */

/**
 * The document every client attaches to purely to be counted present.
 *
 * A Yorkie document key may only contain `a-z A-Z 0-9 - . _ ~`, so this cannot
 * become a `:`-delimited or otherwise punctuated name without breaking attach.
 */
export const WORKSPACE_DOC_KEY = "workspace";

/** What each client publishes about itself (FR-020-08 for the colour tag). */
export type WorkspacePresence = WorkspaceMember & {
  /**
   * Set while this member is sharing their view.
   *
   * `null`, never `undefined`, to end a share: the SDK `JSON.stringify`s every
   * presence value before sending it, and `undefined` does not survive that.
   */
  presenting?: {
    documentId: string;
    blockId: BlockId;
    ratio: number;
  } | null;
};

/**
 * The host, who has no session to mint a `WorkspaceMember` from — without this
 * they would be missing from the roster they administer (UC-011).
 */
export const HOST_PRESENCE: WorkspacePresence = {
  id: "host",
  nickname: "Host",
  colorTag: "#64748b",
};
