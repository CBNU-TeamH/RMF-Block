import type { BlockId } from "@/lib/blocks/types";
import type { Mark } from "@/lib/focus/ink";

/** The content document's own presence shape — separate from `WorkspacePresence`,
 *  which carries the workspace-doc's `presenting` anchor for screen-share/follow
 *  (`docs/design/presence-and-focus.md`). This one is always-on for anyone with
 *  the document open, not gated behind presenting. */
export type BlockPresence = {
  activeBlockId: BlockId | null;
  colorTag: string;
  nickname: string;
  /** `Date.now()` at the last heartbeat — lets a reader treat a block someone
   *  focused and then wandered away from (still attached, no explicit leave
   *  event) as vacated after `OCCUPANCY_TTL_MS`, without an onBlur publish. */
  updatedAt: number;
  /** This browser's `WorkspacePresence["id"]`, so a follower can tell the
   *  presenter's ink from anyone else's (FR-030-13). Optional, and published by
   *  `ink-overlay.tsx` rather than at attach: `presence.set` merges before it
   *  sends, so only a client that has actually drawn carries one. */
  id?: string;
  /** Standing underline/highlight (FR-030-12), capped at `MARK_CAP`. */
  marks?: Array<Mark> | null;
};

export type Occupant = { colorTag: string; nickname: string };

export const OCCUPANCY_TTL_MS = 30_000;
/** One timer, in `use-block-document.ts`, does both jobs at this cadence:
 *  republishes the focused block's `updatedAt`, and re-reads occupancy so a
 *  block someone left ages out even with no new presence event to trigger it.
 *  Well under `OCCUPANCY_TTL_MS` so a block never actually goes stale while
 *  its occupant is still there. */
export const OCCUPANCY_TICK_MS = 5_000;

/** One occupant per occupied block, for the border and gutter avatar. First
 *  occupant found wins a block (multiple people in one block was never
 *  requested); an entry whose heartbeat is older than the TTL is treated as
 *  if it were never there. */
export function occupantsByBlock(
  others: Array<{ presence: BlockPresence }>,
  now: number,
): Map<BlockId, Occupant> {
  const byBlock = new Map<BlockId, Occupant>();

  for (const { presence } of others) {
    const { activeBlockId, colorTag, nickname, updatedAt } = presence;
    if (!activeBlockId) continue;
    if (now - updatedAt > OCCUPANCY_TTL_MS) continue;
    if (byBlock.has(activeBlockId)) continue;

    byBlock.set(activeBlockId, { colorTag, nickname });
  }

  return byBlock;
}

/** The one member whose ink this browser may draw: the presenter it is
 *  following, nobody else (FR-030-13). `null` for anyone not following, which
 *  is the whole of "a non-follower with the document open sees nothing" — the
 *  marks reach every attached client either way, so the gate has to be here.
 *  The colour is the presenter's own, already on their presence. */
export function inkFrom(
  others: Array<{ presence: BlockPresence }>,
  followingId: string | null,
): { marks: Array<Mark>; colorTag: string } | null {
  if (!followingId) return null;

  for (const { presence } of others) {
    if (presence?.id !== followingId) continue;

    return { marks: presence.marks ?? [], colorTag: presence.colorTag };
  }

  return null;
}

/** Whether a fresh `occupantsByBlock` result changed anything worth a
 *  re-render — the periodic re-check for TTL expiry recomputes this every
 *  few seconds regardless of whether anyone's presence actually moved. */
export function sameOccupants(a: Map<BlockId, Occupant>, b: Map<BlockId, Occupant>): boolean {
  if (a.size !== b.size) return false;

  for (const [blockId, occupant] of a) {
    const other = b.get(blockId);
    if (!other || other.colorTag !== occupant.colorTag || other.nickname !== occupant.nickname) {
      return false;
    }
  }

  return true;
}
