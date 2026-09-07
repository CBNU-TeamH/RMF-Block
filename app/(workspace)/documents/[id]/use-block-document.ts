import type { Client, Document } from "@yorkie-js/sdk";
import yorkie from "@yorkie-js/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

import { createText } from "@/lib/blocks/create";
import { readBlocks, toStoredBlock, type BlockDocumentRoot } from "@/lib/blocks/document";
import {
  blockIndexFromEditPath,
  touchesBlockList,
  type TextPatch,
} from "@/lib/blocks/text-surface";
import type { Block, BlockId } from "@/lib/blocks/types";
import {
  occupantColorsByBlock,
  OCCUPANCY_HEARTBEAT_MS,
  type BlockPresence,
} from "@/lib/presence/occupancy";

/** One document's blocks and the Yorkie attachment behind them. `setBlocks` is
 *  returned because the subscription reacts to `remote-change` only — a local
 *  edit is the caller's to apply and republish. */
export function useBlockDocument(client: Client | null, documentId: string, colorTag: string) {
  const [blocks, setBlocks] = useState<Array<Block> | null>(null);
  const [failed, setFailed] = useState(false);
  const [occupantColorByBlock, setOccupantColorByBlock] = useState<Map<BlockId, string>>(
    new Map(),
  );

  const docRef = useRef<Document<BlockDocumentRoot, BlockPresence> | null>(null);
  // Which block currently has focus, or none — a ref because it drives the
  // heartbeat interval, not a render.
  const focusedBlockIdRef = useRef<BlockId | null>(null);
  // Each mounted text block's "apply this to your textarea". Fed by remote
  // edits below and by the editor's own split/merge through `patchBlockText`.
  const handlersRef = useRef(new Map<BlockId, (patch: TextPatch) => void>());

  // Chains one run's teardown in front of the next run's attach(), for React's
  // Strict Mode double-invoke — why, and the `#32` it shares a shape with:
  // `docs/design/document-editing.md`, "Attaching under React's Strict Mode".
  const teardownRef = useRef<Promise<void>>(Promise.resolve());

  // `useCallback` so the identity really is stable for a block's lifetime, which
  // is what `text-block.tsx`'s effect already assumes of it.
  const registerRemoteHandler = useCallback(
    (blockId: BlockId, handler: (patch: TextPatch) => void) => {
      handlersRef.current.set(blockId, handler);
      return () => handlersRef.current.delete(blockId);
    },
    [],
  );


  useEffect(() => {
    if (!client) return;

    const doc = new yorkie.Document<BlockDocumentRoot, BlockPresence>(documentId);
    let cancelled = false;
    // Whether THIS run's attach() went through — independent of `cancelled`.
    let attached = false;
    let unsubscribe: (() => void) | undefined;
    let unsubscribeOccupancy: (() => void) | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let tick: ReturnType<typeof setInterval> | undefined;

    // cleanup(N) runs before effect(N+1), so this holds the previous run's full
    // teardown and attach() below waits for it.
    const readyToAttach = teardownRef.current;

    const setup = (async () => {
      await readyToAttach;
      if (cancelled) return;

      await client.attach(doc, {
        initialPresence: { activeBlockId: null, colorTag, updatedAt: Date.now() },
      });
      attached = true;
      if (cancelled) return;

      // Two peers can both seed an empty document — a known `#42`-material race
      // (`docs/design/document-editing.md`).
      doc.update((root: BlockDocumentRoot) => {
        if (!root.blocks || root.blocks.length === 0) {
          root.blocks = [toStoredBlock(createText())];
        }
      });

      docRef.current = doc;
      setBlocks(readBlocks(doc.getRoot().blocks));

      unsubscribe = doc.subscribe((event) => {
        if (event.type !== "remote-change") return;

        // Once per event, not per op — one conversion already produces two
        // (`docs/design/document-editing.md`).
        let needsRecompute = false;

        for (const op of event.value.operations) {
          if (op.type === "edit") {
            const index = blockIndexFromEditPath(op.path);
            if (index === null) continue;

            const id = doc.getRoot().blocks[index]?.id;
            const handler = id ? handlersRef.current.get(id) : undefined;
            if (handler) {
              handler(op);
              continue;
            }

            // No handler yet — the row exists in the document but has not
            // mounted. Rebuild rather than drop the op (#59); the reasoning is
            // in document-editing.md.
            needsRecompute = true;
            continue;
          }

          // Which paths mean "the list is stale", and why, is stated once in
          // `touchesBlockList` — where it is also tested.
          if (touchesBlockList(op.path)) {
            needsRecompute = true;
          }
        }

        if (needsRecompute) setBlocks(readBlocks(doc.getRoot().blocks));
      });

      // Occupancy: who else has this document open, and which block they're
      // in. `now` is read at compute time, not stored, so a tick with no new
      // presence event still ages a block out once its heartbeat goes stale.
      const readOccupancy = () =>
        setOccupantColorByBlock(occupantColorsByBlock(doc.getOthersPresences(), Date.now()));
      unsubscribeOccupancy = doc.subscribe("others", readOccupancy);
      readOccupancy();

      // Refreshes the focused block's `updatedAt` so it doesn't age out while
      // still actually focused; a no-op once focus moves elsewhere (`onFocus`
      // clears `focusedBlockIdRef` on blur — see `setActiveBlockId`).
      heartbeat = setInterval(() => {
        const blockId = focusedBlockIdRef.current;
        if (!blockId) return;
        doc.update((_root, presence) => {
          presence.set({ activeBlockId: blockId, colorTag, updatedAt: Date.now() });
        });
      }, OCCUPANCY_HEARTBEAT_MS);

      // Nothing about the doc changes when an entry simply goes stale, so
      // this is what actually expires a border once its TTL passes.
      tick = setInterval(readOccupancy, OCCUPANCY_HEARTBEAT_MS / 2);
    })().catch((error: unknown) => {
      if (cancelled) return;
      setFailed(true);
      console.error(`Could not open document ${documentId}`, error);
    });

    return () => {
      cancelled = true;

      // Own this run's teardown and publish it before any of it actually
      // runs, so the next run's `readyToAttach` waits on exactly this.
      const teardown = setup.finally(async () => {
        unsubscribe?.();
        unsubscribeOccupancy?.();
        if (heartbeat) clearInterval(heartbeat);
        if (tick) clearInterval(tick);
        if (docRef.current === doc) docRef.current = null;
        // Only this run's own successful attach left something to release.
        if (attached) await client.detach(doc).catch(() => undefined);
      });

      teardownRef.current = teardown;
    };
  }, [client, documentId, colorTag]);

  /** Reports a block gaining focus, or (`null`) losing it. Losing focus does
   *  not publish anything — the last-focused block's border stays until its
   *  heartbeat goes stale (`OCCUPANCY_TTL_MS`), rather than vanishing the
   *  instant someone clicks the sidebar. */
  const setActiveBlockId = useCallback(
    (blockId: BlockId | null) => {
      focusedBlockIdRef.current = blockId;
      const doc = docRef.current;
      if (!doc || !blockId) return;

      doc.update((_root, presence) => {
        presence.set({ activeBlockId: blockId, colorTag, updatedAt: Date.now() });
      });
    },
    [colorTag],
  );

  /** Patches a textarea with an edit that did not come from the network — a
   *  split or merge (#59). Deliberately the same handler a remote edit uses;
   *  why that matters: `docs/design/document-editing.md`. */
  const patchBlockText = useCallback((blockId: BlockId, patch: TextPatch) => {
    handlersRef.current.get(blockId)?.(patch);
  }, []);

  return {
    blocks,
    setBlocks,
    failed,
    docRef,
    registerRemoteHandler,
    patchBlockText,
    occupantColorByBlock,
    setActiveBlockId,
  };
}
