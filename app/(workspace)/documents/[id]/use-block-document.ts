import type { Client } from "@yorkie-js/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

import { cellKey, fillTable, readTable, tableCellPatches, type CellChange } from "@/lib/blocks/table";
import { createText } from "@/lib/blocks/create";
import { blocksFromMarkdown } from "@/lib/blocks/markdown-import";
import { readBlocks, toStoredBlock, type BlockDocumentRoot } from "@/lib/blocks/document";
import { editBlockText, type BlockArray } from "@/lib/blocks/operations";
import { replaceAllBlocks } from "@/lib/blocks/restore";
import {
  acquireBlockDocument,
  releaseBlockDocument,
  type BlockDocument,
} from "@/lib/documents/attach-pool";
import {
  blockIndexFromEditPath,
  replacesBlockList,
  touchesBlockList,
  type TextPatch,
} from "@/lib/blocks/text-surface";
import type { Block, BlockId } from "@/lib/blocks/types";
import {
  occupantsByBlock,
  sameOccupants,
  OCCUPANCY_TICK_MS,
  type Occupant,
} from "@/lib/presence/occupancy";

import { takeImport } from "../../pending-import";

const TABLE_CELL_TEXT = /\.content\.table\.cells\.\d+\.text$/;

/** One document's blocks and the Yorkie attachment behind them. `setBlocks` is
 *  returned because an ordinary local edit is the caller's to apply and
 *  republish; the subscription takes what has no such caller — remote changes,
 *  and this browser's own undo (`docs/design/document-editing.md`, "Undo is per
 *  person"). */
export function useBlockDocument(
  client: Client | null,
  documentId: string,
  colorTag: string,
  nickname: string,
) {
  const [blocks, setBlocks] = useState<Array<Block> | null>(null);
  /** Bumped by `replaceBlocks`, and part of every row's key — see there. A peer's
   *  restore bumps it too, below. */
  const [restoreCount, setRestoreCount] = useState(0);
  /** How many remounts were asked for; `restoreCount` equals it once the newest has committed. */
  const remountsRef = useRef(0);
  /** A peer replaced the list and the rows have not remounted: edits are read, not patched (#276). */
  const replacingRef = useRef(false);
  useEffect(() => {
    if (restoreCount === remountsRef.current) replacingRef.current = false;
  }, [restoreCount]);
  /** How deep the undo stack was once this document was ready — see where it is
   *  set. `canUndo` alone would let a person undo the document out of existence. */
  const undoFloorRef = useRef(0);
  const [failed, setFailed] = useState(false);
  const [occupantByBlock, setOccupantByBlock] = useState<Map<BlockId, Occupant>>(new Map());

  const docRef = useRef<BlockDocument | null>(null);
  // Which block currently has focus, or none — a ref because it drives the
  // heartbeat interval, not a render.
  const focusedBlockIdRef = useRef<BlockId | null>(null);
  // Each mounted text block's "apply this to your textarea". Fed by remote
  // edits below and by the editor's own split/merge through `patchBlockText`.
  const handlersRef = useRef(new Map<BlockId, (patch: TextPatch) => void>());

  const cellHandlersRef = useRef(new Map<string, (change: CellChange) => void>());
  const registerCellHandler = useCallback((key: string, handler: (change: CellChange) => void) => {
    cellHandlersRef.current.set(key, handler);
    return () => { cellHandlersRef.current.delete(key); };
  }, []);

  // `useCallback` so the identity really is stable for a block's lifetime, which
  // is what `text-block.tsx`'s effect already assumes of it.
  const registerRemoteHandler = useCallback(
    (blockId: BlockId, handler: (patch: TextPatch) => void) => {
      handlersRef.current.set(blockId, handler);
      return () => handlersRef.current.delete(blockId);
    },
    [],
  );

  // Shared by the heartbeat and `setActiveBlockId` — both publish the same
  // shape, so this is written once rather than twice with a drift risk.
  const publishActiveBlock = useCallback(
    (doc: BlockDocument, blockId: BlockId) => {
      doc.update((_root, presence) => {
        presence.set({ activeBlockId: blockId, colorTag, nickname, updatedAt: Date.now() });
      });
    },
    [colorTag, nickname],
  );

  useEffect(() => {
    if (!client) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let unsubscribeOccupancy: (() => void) | undefined;
    let tick: ReturnType<typeof setInterval> | undefined;

    // Shared with any floating view of this document, and what makes Strict
    // Mode's double-invoke safe: the second run's acquire lands before the
    // first run's release, so the count goes 1→2→1 and nothing re-attaches
    // (`docs/design/document-editing.md`, "Attaching under React's Strict Mode").
    // Set only once THIS run's acquire went through — independent of `cancelled`.
    let held: BlockDocument | undefined;

    const setup = (async () => {
      const doc = await acquireBlockDocument(client, documentId, {
        activeBlockId: null,
        colorTag,
        nickname,
        updatedAt: Date.now(),
      });
      held = doc;
      if (cancelled) return;

      // Not trusted to `acquire` — `docs/design/floating-view.md`.
      doc.update((_root, presence) => presence.set({ colorTag, nickname }));
      // A re-run (Strict Mode's second pass, a changed nickname) follows the
      // cleanup that cleared this browser's block. Put it back now, not at the
      // next heartbeat (#127).
      const focused = focusedBlockIdRef.current;
      if (focused) publishActiveBlock(doc, focused);

      // Two peers can both seed an empty document — a known `#42`-material race
      // (`docs/design/document-editing.md`). One made from a Markdown file is
      // seeded with its blocks (`docs/design/app-shell.md`, "Importing Markdown").
      const seed = blocksFromMarkdown(takeImport(documentId) ?? "");
      if (seed.length === 0) seed.push(createText());
      doc.update((root: BlockDocumentRoot) => {
        if (!root.blocks || root.blocks.length === 0) {
          root.blocks = seed.map(toStoredBlock);
        }
      });
      // Strings only after their empty CRDT nodes are in, as `replaceBlocks` does.
      const texts = seed.flatMap((block) => ("text" in block && block.text ? [{ id: block.id, text: block.text }] : []));
      const tables = seed.flatMap((block) => (block.type === "table" ? [block] : []));
      if ((texts.length > 0 || tables.length > 0) && doc.getRoot().blocks[0]?.id === seed[0]!.id) {
        doc.update((root: BlockDocumentRoot) => {
          for (const { id, text } of texts) editBlockText(root.blocks as BlockArray, id, 0, 0, text);
          for (const table of tables) fillTable(root.blocks as BlockArray, table);
        });
      }

      docRef.current = doc;
      // Nothing before this point may be undone. The seed above is a
      // `doc.update()` like any other, and undoing it would leave a document
      // with no blocks and nowhere to type. Measured against 0.7.13 the root
      // assignment happens to produce no reverse op, so the stack is empty here
      // anyway — but that is an accident of which operation the seed uses, and
      // a floor says what is meant. Borrowed from wafflebase's docs store,
      // which hit the same edge from the other side.
      undoFloorRef.current = doc.getUndoStackForTest().length;

      setBlocks(readBlocks(doc.getRoot().blocks));

      unsubscribe = doc.subscribe((event) => {
        // An undo is a `local-change`, not a `remote-change`, and it arrives
        // with no caller to republish the list — `doc.history.undo()` is not
        // this component's `applyEdit`. To everything below, the two are the
        // same thing: a change nothing local is already holding the text for.
        // See `docs/design/document-editing.md`, "Undo is per person".
        const isUndoRedo = event.type === "local-change" && event.source === "undoredo";
        if (event.type !== "remote-change" && !isUndoRedo) return;

        // Once per event, not per op — one conversion already produces two
        // (`docs/design/document-editing.md`).
        let needsRecompute = false;

        for (const op of event.value.operations) {
          // A restore elsewhere keeps the block ids; a new key remounts the rows (#276).
          if (replacesBlockList(op)) {
            replacingRef.current = true;
            setRestoreCount(++remountsRef.current);
            needsRecompute = true;
            continue;
          }
          // The new rows may already have mounted from an older list: remount them again.
          if (op.type === "edit" && replacingRef.current) {
            setRestoreCount(++remountsRef.current);
            needsRecompute = true;
            continue;
          }
          if (op.type === "edit") {
            const index = blockIndexFromEditPath(op.path);
            if (index === null) {
              // A table cell's text is patched through its handler below; only an
              // unmounted cell falls back to a rebuild.
              if (touchesBlockList(op.path) && !TABLE_CELL_TEXT.test(op.path)) needsRecompute = true;
              continue;
            }

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

        // Cells of rows about to remount read their text when they mount.
        const edits = replacingRef.current ? [] : event.value.operations.filter((op) => op.type === "edit");
        const touchedTables = !replacingRef.current && event.value.operations.some((op) => op.path.includes(".content.table"));
        for (const { key, patch } of tableCellPatches(doc.getRoot().blocks, edits)) {
          const handler = cellHandlersRef.current.get(key);
          if (handler) handler(patch);
          else needsRecompute = true;
        }
        for (const block of touchedTables ? doc.getRoot().blocks : []) {
          if (block?.type !== "table") continue;
          const table = readTable(block.content?.table);
          for (const row of table.rows) {
            for (const column of table.columns) {
              const key = cellKey(row, column);
              cellHandlersRef.current.get(`${block.id}:${key}`)?.({ text: table.cells[key] ?? "" });
            }
          }
        }
        if (needsRecompute) setBlocks(readBlocks(doc.getRoot().blocks));
      });

      // Occupancy: who else has this document open, and which block they're
      // in. `now` is read at compute time, not stored, so re-reading on a
      // timer (not just on a presence event) is what ages a block out once
      // its heartbeat goes stale — nothing about the doc changes when an
      // entry simply goes stale. The equality check skips the state update
      // (and the re-render it would cause) on every tick where nothing
      // actually changed, which is most of them.
      const readOccupancy = () => {
        const next = occupantsByBlock(doc.getOthersPresences(), Date.now());
        setOccupantByBlock((prev) => (sameOccupants(prev, next) ? prev : next));
      };
      unsubscribeOccupancy = doc.subscribe("others", readOccupancy);
      readOccupancy();

      // One timer for both halves of staying present: refresh the focused
      // block's `updatedAt` so it doesn't age out while still actually
      // focused (a no-op once focus moves elsewhere — `onFocus` clears
      // `focusedBlockIdRef` on blur, see `setActiveBlockId`), and re-check
      // occupancy for TTL expiry.
      tick = setInterval(() => {
        const blockId = focusedBlockIdRef.current;
        if (blockId) publishActiveBlock(doc, blockId);
        readOccupancy();
      }, OCCUPANCY_TICK_MS);
    })().catch((error: unknown) => {
      if (cancelled) return;
      setFailed(true);
      console.error(`Could not open document ${documentId}`, error);
    });

    return () => {
      cancelled = true;
      // Now, not once setup settles — `docs/design/floating-view.md`.
      docRef.current = null;

      void setup.finally(() => {
        unsubscribe?.();
        unsubscribeOccupancy?.();
        if (tick) clearInterval(tick);
        // Only this run's own successful acquire holds a share to give back.
        if (!held) return;
        // A floating view may keep it attached — `docs/design/floating-view.md`.
        held.update((_root, presence) =>
          presence.set({ activeBlockId: null, marks: null, pointer: null }),
        );
        releaseBlockDocument(client, documentId);
      });
    };
  }, [client, documentId, colorTag, nickname, publishActiveBlock]);

  /** Reports a block gaining focus, or (`null`) losing it. Losing focus does
   *  not publish anything — the last-focused block's border stays until its
   *  heartbeat goes stale (`OCCUPANCY_TTL_MS`), rather than vanishing the
   *  instant someone clicks the sidebar. */
  const setActiveBlockId = useCallback(
    (blockId: BlockId | null) => {
      focusedBlockIdRef.current = blockId;
      const doc = docRef.current;
      if (!doc || !blockId) return;

      publishActiveBlock(doc, blockId);
    },
    [publishActiveBlock],
  );

  /**
   * Undo and redo, floored at the state this document was opened in.
   *
   * Yorkie's stack holds only this browser's own changes, so neither can ever
   * take back what a peer typed (`docs/design/document-editing.md`, "Undo is
   * per person"). The floor is what stops an undo reaching past the seed.
   */
  const history = useCallback((direction: "undo" | "redo") => {
    const doc = docRef.current;
    if (!doc) return;

    if (direction === "redo") {
      if (doc.history.canRedo()) doc.history.redo();
      return;
    }

    if (!doc.history.canUndo()) return;
    if (doc.getUndoStackForTest().length <= undoFloorRef.current) return;

    doc.history.undo();
  }, []);

  /** Patches a textarea with an edit that did not come from the network — a
   *  split or merge (#59). Deliberately the same handler a remote edit uses;
   *  why that matters: `docs/design/document-editing.md`. */
  const patchBlockText = useCallback((blockId: BlockId, patch: TextPatch) => {
    handlersRef.current.get(blockId)?.(patch);
  }, []);

  /** Replaces every block, which is how a revision is restored — and why the
   *  app restores rather than calling `client.restoreRevision`:
   *  `docs/design/version-history.md`. One update, so one Ctrl+Z takes the
   *  whole restore back (#185). The read afterwards is not optional: a local
   *  change never comes back through `doc.subscribe`. */
  const replaceBlocks = useCallback((next: Array<Block>) => {
    const doc = docRef.current;
    if (!doc) return;

    doc.update((root: BlockDocumentRoot) => replaceAllBlocks(root, next));

    setBlocks(readBlocks(doc.getRoot().blocks));
    // Remounts every row: a reused one keeps its pre-restore text and diff
    // baseline (`docs/design/version-history.md`, "Why the app restores").
    setRestoreCount(++remountsRef.current);
  }, []);

  return {
    blocks,
    setBlocks,
    failed,
    docRef,
    registerRemoteHandler,
    registerCellHandler,
    patchBlockText,
    replaceBlocks,
    restoreCount,
    history,
    occupantByBlock,
    setActiveBlockId,
  };
}
