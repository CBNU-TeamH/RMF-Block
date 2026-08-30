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

  const registerRemoteHandler = (blockId: BlockId, handler: (op: EditOpInfo) => void) => {
    handlersRef.current.set(blockId, handler);
    return () => handlersRef.current.delete(blockId);
  };

  useEffect(() => {
    if (!client) return;

    const doc = new yorkie.Document<BlockDocumentRoot>(documentId);
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const setup = (async () => {
      await client.attach(doc, { initialPresence: {} });
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
      void setup.finally(() => {
        unsubscribe?.();
        // Detaches only this document — the client is shared with the
        // workspace roster and stays connected across navigations.
        if (docRef.current) client.detach(docRef.current).catch(() => undefined);
        docRef.current = null;
      });
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
