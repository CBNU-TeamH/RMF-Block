import { documentToMarkdown } from "../blocks/markdown.ts";
import type { Block } from "../blocks/types.ts";
import { childrenOf, subtreeIds, type TreeNode } from "./tree.ts";

/** What a Markdown export holds and where (FR-022-15/16). The layout, the
 *  naming rules and why the server builds it: `docs/design/document-export.md`. */

export type ExportDocument = TreeNode & { name: string };

export type ExportEntry = { path: string; text: string } | { path: string; fileId: string };

export type ExportPlan = {
  /** `<name>.md` when the export is that one file, `<name>.zip` otherwise. */
  fileName: string;
  entries: Array<ExportEntry>;
};

const UNTITLED = "제목 없음";

/** The documents an export holds: `rootId`, and with `includeSubpages` everything under it. */
export function exportedIds(documents: Array<TreeNode>, rootId: string, includeSubpages: boolean): Array<string> {
  return includeSubpages ? subtreeIds(documents, rootId) : [rootId];
}

/** Every file id the exported documents' blocks embed, for the caller to look up. */
export function embeddedFileIds(blocks: Map<string, Array<Block>>): Set<string> {
  const ids = new Set<string>();
  for (const list of blocks.values()) {
    for (const block of list) if ("fileId" in block) ids.add(block.fileId);
  }
  return ids;
}

/** A name every common file system takes: no character Windows refuses, no
 *  trailing dot or space, none of its device names. */
export function safeName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_")
    .trim()
    .replace(/[. ]+$/, "");
  if (!cleaned) return UNTITLED;
  return /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(cleaned) ? `_${cleaned}` : cleaned;
}

/**
 * The export's files. The root is `<name>.md`; whatever it holds — attachments
 * and sub-pages — sits in a `<name>/` folder beside it, and each sub-page does
 * the same inside that. One entry means a bare `.md`, more mean a zip.
 *
 * `blocks` has an entry for each exported document (an empty list for one never
 * opened); `hasFile` says whether a file's bytes can still be read.
 */
export function planExport({
  documents,
  rootId,
  includeSubpages,
  blocks,
  hasFile,
  origin,
}: {
  documents: Array<ExportDocument>;
  rootId: string;
  includeSubpages: boolean;
  blocks: Map<string, Array<Block>>;
  hasFile: (fileId: string) => boolean;
  origin: string;
}): ExportPlan {
  const byId = new Map(documents.map((document) => [document.id, document]));
  const ids = exportedIds(documents, rootId, includeSubpages);
  const exported = new Set(ids);
  const rootName = safeName(byId.get(rootId)?.name ?? "");

  // Names already used in each folder, compared without case as Windows does.
  const taken = new Map<string, Set<string>>();
  const claim = (folder: string, candidates: (n: number) => Array<string>): string => {
    const used = taken.get(folder) ?? new Set<string>();
    taken.set(folder, used);
    for (let n = 1; ; n += 1) {
      const names = candidates(n);
      if (names.some((name) => used.has(name.toLowerCase()))) continue;
      for (const name of names) used.add(name.toLowerCase());
      return names[0]!;
    }
  };
  const numbered = (name: string, n: number) => (n === 1 ? name : `${name} (${n})`);

  // Where each document's `.md` and folder go. `subtreeIds` is breadth-first,
  // so a parent is placed before its children.
  const markdownPath = new Map([[rootId, `${rootName}.md`]]);
  const folderOf = new Map([[rootId, rootName]]);
  for (const id of ids) {
    const folder = folderOf.get(id)!;
    for (const child of childrenOf(documents, id)) {
      if (!exported.has(child.id)) continue;
      const base = safeName(child.name);
      const name = claim(folder, (n) => [numbered(base, n), `${numbered(base, n)}.md`]);
      markdownPath.set(child.id, `${folder}/${name}.md`);
      folderOf.set(child.id, `${folder}/${name}`);
    }
  }

  // Each file once, in the folder of the first document that embeds it.
  const filePath = new Map<string, string>();
  for (const id of ids) {
    for (const block of blocks.get(id) ?? []) {
      if (!("fileId" in block)) continue;
      if (filePath.has(block.fileId) || !hasFile(block.fileId)) continue;
      const name = safeName(block.fileName);
      const dot = name.lastIndexOf(".");
      const [stem, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
      const folder = folderOf.get(id)!;
      filePath.set(block.fileId, `${folder}/${claim(folder, (n) => [`${numbered(stem, n)}${extension}`])}`);
    }
  }

  const entries: Array<ExportEntry> = ids.map((id) => {
    const from = markdownPath.get(id)!;
    const text = documentToMarkdown(blocks.get(id) ?? [], origin, {
      file: (fileId) => {
        const path = filePath.get(fileId);
        return path ? relativePath(from, path) : null;
      },
      document: (documentId) => {
        const path = markdownPath.get(documentId);
        return path ? { path: relativePath(from, path), name: byId.get(documentId)?.name || UNTITLED } : null;
      },
    });
    return { path: from, text };
  });
  for (const [fileId, path] of filePath) entries.push({ path, fileId });

  return { fileName: entries.length === 1 ? `${rootName}.md` : `${rootName}.zip`, entries };
}

/** `to` as seen from the file `from`, both paths in the export. */
function relativePath(from: string, to: string): string {
  const fromDir = from.split("/").slice(0, -1);
  const target = to.split("/");
  let common = 0;
  while (common < fromDir.length && common < target.length - 1 && fromDir[common] === target[common]) common += 1;
  return [...fromDir.slice(common).map(() => ".."), ...target.slice(common)].join("/");
}
