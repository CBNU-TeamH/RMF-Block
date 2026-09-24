import type { Client, Document } from "@yorkie-js/sdk";
import yorkie from "@yorkie-js/sdk";

import type { BlockDocumentRoot } from "../blocks/document.ts";
import type { BlockPresence } from "../presence/occupancy.ts";

/** One attachment per document key, shared by everyone who holds it. Yorkie
 *  refuses a second `attach` of a key the client already has, and the editor and
 *  a floating view of one of its blocks both need the same document
 *  (`docs/design/document-editing.md`, "Attaching under React's Strict Mode"). */
export type AttachPool<D, I> = {
  /** The key's document, attaching it on first use. `init` only counts then. */
  acquire(key: string, init: I): Promise<D>;
  /** Once per acquire that resolved. The last one detaches. */
  release(key: string): void;
};

export function createAttachPool<D, I>(
  attach: (key: string, init: I) => Promise<D>,
  detach: (doc: D) => Promise<unknown>,
): AttachPool<D, I> {
  const live = new Map<string, { count: number; ready: Promise<D> }>();
  // Each key's last detach. The next attach of that key waits for it — the
  // server still marks the document Attached until it lands. Kept once settled:
  // one resolved promise per key ever opened.
  const tail = new Map<string, Promise<void>>();

  return {
    acquire(key, init) {
      const entry = live.get(key);
      if (entry) {
        entry.count += 1;
        return entry.ready;
      }

      const ready = (tail.get(key) ?? Promise.resolve()).then(() => attach(key, init));
      const created = { count: 1, ready };
      live.set(key, created);
      // A failed attach leaves nothing to release, so the next acquire retries.
      ready.catch(() => {
        if (live.get(key) === created) live.delete(key);
      });
      return ready;
    },

    release(key) {
      const entry = live.get(key);
      if (!entry) return;

      entry.count -= 1;
      if (entry.count > 0) return;

      live.delete(key);
      // Swallowed like the editor's detach always was: a client deactivating
      // underneath has already detached everything.
      tail.set(
        key,
        entry.ready.then(detach).then(
          () => undefined,
          () => undefined,
        ),
      );
    },
  };
}

export type BlockDocument = Document<BlockDocumentRoot, BlockPresence>;

const pools = new WeakMap<Client, AttachPool<BlockDocument, BlockPresence>>();

function poolFor(client: Client): AttachPool<BlockDocument, BlockPresence> {
  let pool = pools.get(client);
  if (!pool) {
    pool = createAttachPool<BlockDocument, BlockPresence>(
      async (key, initialPresence) => {
        const doc = new yorkie.Document<BlockDocumentRoot, BlockPresence>(key);
        await client.attach(doc, { initialPresence });
        return doc;
      },
      (doc) => client.detach(doc),
    );
    pools.set(client, pool);
  }
  return pool;
}

/** A content document through `client`'s pool — the editor's and every
 *  floating view's one way in. */
export function acquireBlockDocument(
  client: Client,
  documentId: string,
  presence: BlockPresence,
): Promise<BlockDocument> {
  return poolFor(client).acquire(documentId, presence);
}

export function releaseBlockDocument(client: Client, documentId: string): void {
  poolFor(client).release(documentId);
}
