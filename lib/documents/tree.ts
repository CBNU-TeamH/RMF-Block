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

/**
 * `id` and everything under it, deepest last.
 *
 * Delete uses this: FR-023-06 removes a document's sub-documents with it, and
 * doing that as one list means one write rather than a cascade that can stop
 * half way.
 */
export function subtreeIds(
  documents: Array<TreeNode>,
  id: string,
): Array<string> {
  const ids = [id];

  // Breadth-first over `ids` as it grows, so a document that is its own
  // ancestor — which `wouldCycle` refuses to create, but a hand-edited file
  // could still hold — cannot loop here.
  for (let i = 0; i < ids.length; i += 1) {
    for (const child of childrenOf(documents, ids[i]!)) {
      if (!ids.includes(child.id)) ids.push(child.id);
    }
  }

  return ids;
}

/**
 * Whether moving `id` under `nextParentId` would make a document its own
 * ancestor.
 *
 * Nothing in the SRS forbids it, because nobody writes down that a document
 * cannot be its own grandparent. A UI that lets a person drag a parent onto its
 * own child produces exactly that, and the loop it makes is unreachable from
 * the root — invisible in the tree, and gone from every view that renders one.
 */
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
 * `collapsed` names the documents whose children are hidden; their descendants
 * are left out entirely rather than marked, so a renderer never has to know
 * about collapsing at all.
 *
 * A document whose `parentId` names something that is not here is treated as a
 * root. That is not defensive: FR-023-04 deletes a parent and this reads the
 * file, so a partially written catalogue — or one an older build wrote — would
 * otherwise render nothing at all.
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
