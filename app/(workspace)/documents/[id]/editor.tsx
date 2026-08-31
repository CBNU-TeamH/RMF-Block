"use client";

import yorkie, { type Document, type EditOpInfo } from "@yorkie-js/sdk";
import { useEffect, useRef, useState } from "react";

import { createText } from "@/lib/blocks/create";
import { readBlocks, toStoredBlock, type BlockDocumentRoot } from "@/lib/blocks/document";
import { blockIndexFromEditPath } from "@/lib/blocks/text-surface";
import type { Block, BlockId } from "@/lib/blocks/types";

import { useWorkspacePresence } from "../../presence-provider";
import { TextBlockView } from "./text-block";

/**
 * Attaches `documentId` through the workspace's one Yorkie client
 * (`presence-provider.tsx`) and renders its blocks (FR-022-02, FR-022-09).
 *
 * A brand-new document arrives with no `blocks` at all — `POST /api/documents`
 * never touches Yorkie, on purpose, so creating one never needs a
 * server-side Yorkie client. Seeding `root.blocks = [text]` happens here
 * instead, the first time anyone opens it, matching UC-021's "생성된 문서의
 * 편집기를 사용자 편집 화면에 표시한다".
 *
 * One `doc.subscribe()` for the whole document, not one per block: a text
 * edit's path is positional (`$.blocks.<i>.content.text`), not by block id
 * (`document-editing.md`, "Subscribing to remote changes"), so the block a
 * path names is resolved fresh from the current array on every event instead
 * of being fixed at subscribe time.
 *
 * Milestone 2 only edits text within whatever blocks already exist — nothing
 * yet creates, deletes or moves one, so the block list itself is read once
 * after seeding and never recomputed. Milestone 3 is what makes that list
 * change.
 */
export function DocumentEditor({ documentId }: { documentId: string }) {
  const { client } = useWorkspacePresence();
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

  const registerRemoteHandler = (blockId: BlockId, handler: (op: EditOpInfo) => void) => {
    handlersRef.current.set(blockId, handler);
    return () => handlersRef.current.delete(blockId);
  };

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

        for (const op of event.value.operations) {
          if (op.type !== "edit") continue;

          const index = blockIndexFromEditPath(op.path);
          if (index === null) continue;

          const id = doc.getRoot().blocks[index]?.id;
          if (id) handlersRef.current.get(id)?.(op);
        }
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

  if (failed) {
    return <p className="text-sm text-red-600">문서를 열지 못했습니다. 새로고침해 주세요.</p>;
  }

  if (!client || blocks === null) {
    return <p className="text-sm text-ink-faint">여는 중…</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {blocks.map((block) =>
        block.type === "text" ? (
          <TextBlockView
            key={block.id}
            blockId={block.id}
            initialText={block.text}
            docRef={docRef}
            registerRemoteHandler={registerRemoteHandler}
          />
        ) : (
          // Nothing before milestone 4 can create these, but the array is
          // read off whatever is actually in the document, not what this
          // build wrote — the same reason `readBlocks` drops rather than
          // crashes on a type it does not know.
          <p key={block.id} className="p-1.5 text-sm text-ink-faint">
            아직 편집할 수 없는 블록입니다 ({block.type}).
          </p>
        ),
      )}
    </div>
  );
}
