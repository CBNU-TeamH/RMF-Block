import type { BlockId } from "@/lib/blocks/types";

/** The content document's own presence shape — separate from `WorkspacePresence`,
 *  which carries the workspace-doc's `presenting` anchor for screen-share/follow
 *  (`docs/design/presence-and-focus.md`). This one is always-on for anyone with
 *  the document open, not gated behind presenting. */
export type BlockPresence = {
  activeBlockId: BlockId | null;
  colorTag: string;
  /** `Date.now()` at the last heartbeat — lets a reader treat a block someone
   *  focused and then wandered away from (still attached, no explicit leave
   *  event) as vacated after `OCCUPANCY_TTL_MS`, without an onBlur publish. */
  updatedAt: number;
};

export const OCCUPANCY_TTL_MS = 30_000;
export const OCCUPANCY_HEARTBEAT_MS = 10_000;

/** One color per occupied block, for borders. First occupant found wins a
 *  block (multiple people in one block was never requested); an entry whose
 *  heartbeat is older than the TTL is treated as if it were never there. */
export function occupantColorsByBlock(
  others: Array<{ presence: BlockPresence }>,
  now: number,
): Map<BlockId, string> {
  const byBlock = new Map<BlockId, string>();

  for (const { presence } of others) {
    const { activeBlockId, colorTag, updatedAt } = presence;
    if (!activeBlockId) continue;
    if (now - updatedAt > OCCUPANCY_TTL_MS) continue;
    if (byBlock.has(activeBlockId)) continue;

    byBlock.set(activeBlockId, colorTag);
  }

  return byBlock;
}
