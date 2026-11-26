import { documentToMarkdown } from "../blocks/markdown.ts";
import type { Block } from "../blocks/types.ts";
import { childrenOf, type TreeNode } from "./tree.ts";

/** What a Markdown export holds and where (FR-022-15/16). The layout, the
 *  naming rules and why the server builds it: `docs/design/document-export.md`. */

export type ExportDocument = TreeNode & { name: string };

export type ExportEntry = { path: string; text: string } | { path: string; fileId: string };

/** One `.md` when that is all there is, a zip otherwise. */
export type ExportPlan =
  | { kind: "markdown"; fileName: string; text: string }
  | { kind: "zip"; fileName: string; entries: Array<ExportEntry> };

const UNTITLED = "제목 없음";

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
 * `ids` are the exported documents, the root first and each parent before its
 * children (`subtreeIds`' order); `blocks` holds their blocks (an empty list for
 * one never opened); `hasFile` says whether a file's bytes can still be read.
 */
export function planExport({
  documents,
  ids,
  blocks,
  hasFile,
  origin,
}: {
  documents: Array<ExportDocument>;
  ids: Array<string>;
  blocks: Map<string, Array<Block>>;
  hasFile: (fileId: string) => boolean;
  origin: string;
}): ExportPlan {
  const byId = new Map(documents.map((document) => [document.id, document]));
  const [rootId] = ids as [string];
  const exported = new Set(ids);
  const rootName = safeName(byId.get(rootId)?.name ?? "");

  // Names already used in each folder, compared without case as Windows does and
  // in one Unicode form as macOS does — a Korean name uploaded from a Mac is
  // decomposed, the same name from Windows is not.
  const taken = new Map<string, Set<string>>();
  const key = (name: string) => name.normalize("NFC").toLowerCase();
  const claim = (folder: string, candidates: (n: number) => Array<string>): string => {
    const used = taken.get(folder) ?? new Set<string>();
    taken.set(folder, used);
    for (let n = 1; ; n += 1) {
      const names = candidates(n);
      if (names.some((name) => used.has(key(name)))) continue;
      for (const name of names) used.add(key(name));
      return names[0]!;
    }
  };
  const numbered = (name: string, n: number) => (n === 1 ? name : `${name} (${n})`);

  // Where each document's `.md` and folder go, a parent before its children.
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

  const [only] = entries;
  return entries.length === 1 && only && "text" in only
    ? { kind: "markdown", fileName: `${rootName}.md`, text: only.text }
    : { kind: "zip", fileName: `${rootName}.zip`, entries };
}

/** `to` as seen from the file `from`, both paths in the export. */
function relativePath(from: string, to: string): string {
  const fromDir = from.split("/").slice(0, -1);
  const target = to.split("/");
  let common = 0;
  while (common < fromDir.length && common < target.length - 1 && fromDir[common] === target[common]) common += 1;
  return [...fromDir.slice(common).map(() => ".."), ...target.slice(common)].join("/");
}
