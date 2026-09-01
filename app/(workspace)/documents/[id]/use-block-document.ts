import type { Client, Document, EditOpInfo } from "@yorkie-js/sdk";
import yorkie from "@yorkie-js/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

import { createText } from "@/lib/blocks/create";
import { readBlocks, toStoredBlock, type BlockDocumentRoot } from "@/lib/blocks/document";
import { blockIndexFromEditPath } from "@/lib/blocks/text-surface";
import type { Block, BlockId } from "@/lib/blocks/types";

/**
 * One document's blocks, and the Yorkie attachment behind them.
 *
 * Lifted out of `editor.tsx` whole, without a behaviour change, because it is
 * the part of that file least connected to the rest of it: it needs a client
 * and a document id, and it hands back a block list. Everything difficult in
 * here — the Strict-Mode teardown chaining, the op-path filtering, the seeding
 * race — is difficult on its own terms and is easier to hold in the head at
 * five fields wide than buried between a drag handler and a file upload.
 *
 * `setBlocks` is returned rather than kept private: a *local* edit is applied
 * to the document directly by the caller (`applyEdit` in `editor.tsx`), and the
 * subscription below deliberately reacts to `remote-change` only, so the caller
 * is the one that has to republish the list afterwards.
 */
export function useBlockDocument(client: Client | null, documentId: string) {
  const [blocks, setBlocks] = useState<Array<Block> | null>(null);
  const [failed, setFailed] = useState(false);

  const docRef = useRef<Document<BlockDocumentRoot> | null>(null);
  const handlersRef = useRef(new Map<BlockId, (op: EditOpInfo) => void>());

  // Chains one run's full teardown (unsubscribe + detach) in front of the
  // next run's attach(). React's Strict Mode double-invokes this effect on
  // mount (dev only) — mount → cleanup → mount, synchronously — which would
  // otherwise fire two attach()es back to back for the same document key
  // from the same client. Measured: the second one fails with a misleading
  // "client not found", because Yorkie's server-side TryAttaching filters on
  // the document not already being Attached for this client, and a cancelled
  // run whose attach() succeeded anyway was never detached — same shape as
  // `#32` in presence-provider.tsx, one layer deeper (the content document,
  // not the workspace one).
  const teardownRef = useRef<Promise<void>>(Promise.resolve());

  // `useCallback` so the identity really is stable for a block's lifetime,
  // which is what `text-block.tsx`'s own effect comment already assumes of it.
  // Nothing observable changes — that effect reads this once, with empty deps —
  // but the claim is now true rather than true-in-practice.
  const registerRemoteHandler = useCallback(
    (blockId: BlockId, handler: (op: EditOpInfo) => void) => {
      handlersRef.current.set(blockId, handler);
      return () => handlersRef.current.delete(blockId);
    },
    [],
  );


  useEffect(() => {
    if (!client) return;

    const doc = new yorkie.Document<BlockDocumentRoot>(documentId);
    let cancelled = false;
    // Whether THIS run's attach() itself went through — independent of
    // `cancelled`, and independent of `docRef`, which a cancelled run never
    // gets to touch.
    let attached = false;
    let unsubscribe: (() => void) | undefined;

    // React runs cleanup(N) before effect(N+1) even in Strict Mode's
    // synchronous double-invoke, so whatever `teardownRef.current` holds here
    // is exactly the previous run's full teardown — attach() below waits for
    // it, so it never reaches the server while that run's document is still
    // marked Attached.
    const readyToAttach = teardownRef.current;

    const setup = (async () => {
      await readyToAttach;
      if (cancelled) return;

      await client.attach(doc, { initialPresence: {} });
      attached = true;
      if (cancelled) return;

      // Two people opening the same brand-new document at once could both
      // see it empty and both seed it — last-write-wins on `blocks` as a
      // whole, so one seed's block would replace the other's outright. The
      // same category of race `changeBlockType` already accepts for a
      // conversion two people make at once; worth measuring properly
      // (`#42`) if it ever turns out to matter at this app's scale.
      doc.update((root: BlockDocumentRoot) => {
        if (!root.blocks || root.blocks.length === 0) {
          root.blocks = [toStoredBlock(createText())];
        }
      });

      docRef.current = doc;
      setBlocks(readBlocks(doc.getRoot().blocks));

      unsubscribe = doc.subscribe((event) => {
        if (event.type !== "remote-change") return;

        // Recomputed at most once per event, not once per matching op — a
        // markdown-shortcut conversion alone already produces two ("set" on
        // the block's `type`, "set" on its `content"), and a multi-block
        // paste or reorder could add more. Recomputing `blocks` is an O(n)
        // read of the whole array, so this only costs it once per batch
        // instead of once per op inside one.
        let needsRecompute = false;

        for (const op of event.value.operations) {
          if (op.type === "edit") {
            const index = blockIndexFromEditPath(op.path);
            if (index === null) continue;

            const id = doc.getRoot().blocks[index]?.id;
            if (id) handlersRef.current.get(id)?.(op);
            continue;
          }

          // Anything else touching the blocks array or a field inside one
          // block: split/merge/reorder (add/remove/move, path exactly
          // "$.blocks") or a markdown-shortcut conversion's set/remove on
          // the block's own fields (`changeBlockType` sets `type` at
          // "$.blocks.<i>" and level/style/checked at
          // "$.blocks.<i>.content" — a peer's heading conversion was
          // otherwise invisible here until a later, unrelated edit finally
          // recomputed `blocks` for some other reason). Recomputed rather
          // than patched either way: unlike a text edit there is no single
          // DOM node whose value moved, the rendered list itself is stale.
          if (op.path === "$.blocks" || op.path.startsWith("$.blocks.")) {
            needsRecompute = true;
          }
        }

        if (needsRecompute) setBlocks(readBlocks(doc.getRoot().blocks));
      });
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
        if (docRef.current === doc) docRef.current = null;
        // Only this run's own successful attach leaves something to
        // release — a run cancelled before attach() resolved never touched
        // the server, so detaching it would be a no-op at best.
        if (attached) await client.detach(doc).catch(() => undefined);
      });

      teardownRef.current = teardown;
    };
  }, [client, documentId]);

  return { blocks, setBlocks, failed, docRef, registerRemoteHandler };
}
