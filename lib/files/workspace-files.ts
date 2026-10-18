import { kindOf, type AttachmentKind } from "../chat/attachments.ts";
import type { ChatMessage } from "../chat/types.ts";
import type { StoredFile } from "./types.ts";

/** UC-050's list: every file a live document block embeds, and every chat
 *  attachment, newest first. Why chat files are in it, and why a file's block is
 *  read from the documents rather than recorded: `docs/design/file-manager.md`. */

export type FileSource =
  | { kind: "document"; documentId: string; documentName: string; blockId: string }
  | { kind: "chat"; messageId: string };

export type WorkspaceFile = {
  fileId: string;
  name: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  kind: AttachmentKind;
  source: FileSource;
};

type Place = { documentId: string; blockId: string };

type RootBlock = { id?: unknown; type?: unknown; content?: { fileId?: unknown } } | null;

const FILE_BLOCK_TYPES = new Set(["file", "image", "pdf"]);

/** The first live block holding each file. A root the editor would not write is
 *  skipped rather than fatal: nothing on the LAN validates a document. */
function placesOf(documents: Array<{ id: string }>, roots: Map<string, string>): Map<string, Place> {
  const places = new Map<string, Place>();
  for (const { id } of documents) {
    let blocks: unknown;
    try {
      blocks = (JSON.parse(roots.get(id) ?? "{}") as { blocks?: unknown }).blocks;
    } catch {
      continue;
    }
    if (!Array.isArray(blocks)) continue;

    for (const block of blocks as Array<RootBlock>) {
      const fileId = block?.content?.fileId;
      if (!FILE_BLOCK_TYPES.has(String(block?.type)) || typeof fileId !== "string" || typeof block?.id !== "string") continue;
      if (!places.has(fileId)) places.set(fileId, { documentId: id, blockId: block.id });
    }
  }
  return places;
}

export function workspaceFiles({
  documents,
  roots,
  files,
  messages,
}: {
  documents: Array<{ id: string; name: string }>;
  /** `null` when Yorkie could not be read: no document file can be placed then. */
  roots: Map<string, string> | null;
  files: Array<StoredFile>;
  messages: Array<ChatMessage>;
}): Array<WorkspaceFile> {
  const names = new Map(documents.map((document) => [document.id, document.name]));
  const places = roots ? placesOf(documents, roots) : new Map<string, Place>();
  const listed: Array<WorkspaceFile> = [];

  for (const file of files) {
    const place = file.origin === "document" ? places.get(file.id) : undefined;
    // No live block holds it — deleted, or in a trashed document (FR-050-06).
    if (!place) continue;
    listed.push({
      fileId: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedBy: file.uploadedBy,
      uploadedAt: file.uploadedAt,
      kind: kindOf(file.type),
      source: { kind: "document", ...place, documentName: names.get(place.documentId) ?? "" },
    });
  }

  for (const { id, sender, sentAt, attachment } of messages) {
    if (!attachment) continue;
    listed.push({
      fileId: attachment.fileId,
      name: attachment.fileName,
      type: attachment.fileType,
      size: attachment.size,
      uploadedBy: sender,
      uploadedAt: sentAt,
      kind: kindOf(attachment.fileType),
      source: { kind: "chat", messageId: id },
    });
  }

  return listed.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}
