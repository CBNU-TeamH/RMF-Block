/**
 * The shape this module needs, which is all it should ask for. A caller's rows
 * usually carry more — the document list joins a creator onto each — and a
 * function about *where a document sits* has no business naming those.
 */
export type TreeNode = { id: string; parentId?: string | null };

/** A document plus where it sits, for a renderer that draws one flat list of
 *  rows and indents them. */
export type TreeRow<T extends TreeNode> = {
  document: T;
  depth: number;
  hasChildren: boolean;
};

/** The children of `parentId`, in the catalogue's own order. */
export function childrenOf<T extends TreeNode>(
  documents: Array<T>,
  parentId: string | null,
): Array<T> {
  return documents.filter((document) => (document.parentId ?? null) === parentId);
}

/** `id` and everything under it. Delete takes this list in one write
 *  (FR-023-06) — why one write: `docs/design/api.md`, "The document endpoints". */
export function subtreeIds(
  documents: Array<TreeNode>,
  id: string,
): Array<string> {
  const ids = [id];

  // Breadth-first over `ids` as it grows: a hand-edited file can hold a cycle
  // `wouldCycle` would have refused, and this must not hang on it.
  for (let i = 0; i < ids.length; i += 1) {
    for (const child of childrenOf(documents, ids[i]!)) {
      if (!ids.includes(child.id)) ids.push(child.id);
    }
  }

  return ids;
}

/** Whether moving `id` under `nextParentId` would make a document its own
 *  ancestor. Why that is refused although no requirement names it:
 *  `docs/design/api.md`, "The document endpoints". */
export function wouldCycle(
  documents: Array<TreeNode>,
  id: string,
  nextParentId: string | null,
): boolean {
  if (nextParentId === null) return false;
  if (nextParentId === id) return true;

  return subtreeIds(documents, id).includes(nextParentId);
}

/**
 * The catalogue as rows to draw, parents before their children.
 *
 * A collapsed node's descendants are left out entirely rather than marked, so a
 * renderer never has to know about collapsing.
 *
 * A `parentId` naming something absent is drawn as a root — not defensive: this
 * reads a file FR-023-04 deletes from, and the alternative is rendering nothing.
 */
export function treeRows<T extends TreeNode>(
  documents: Array<T>,
  collapsed: ReadonlySet<string> = new Set(),
): Array<TreeRow<T>> {
  const byId = new Set(documents.map((document) => document.id));
  const rootsAndOrphans = documents.filter((document) => {
    const parent = document.parentId ?? null;
    return parent === null || !byId.has(parent);
  });

  const rows: Array<TreeRow<T>> = [];

  const walk = (document: T, depth: number) => {
    const children = childrenOf(documents, document.id);
    rows.push({ document, depth, hasChildren: children.length > 0 });

    if (collapsed.has(document.id)) return;
    for (const child of children) walk(child, depth + 1);
  };

  for (const root of rootsAndOrphans) walk(root, 0);

  return rows;
}
