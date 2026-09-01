/**
 * Files uploaded into the workspace — through chat (FR-060-02) or into a
 * document as a file block (FR-022-13/14). `docs/design/api.md` §1 points both
 * FR-061-04 (chat) and FR-050-04 (documents) at the same
 * `/api/files/:id/download`. One store rather than two, with `origin`
 * recording which side put a file there.
 */

/**
 * Where a file came from — a chat attachment (FR-060-02) or a document file
 * block (FR-022-13/14). This is what FR-050-06 ("exclude files whose block was
 * deleted") and FR-061-01 filter on: the same store holds both, and only the
 * origin distinguishes them.
 *
 * A union rather than a bare string, so a typo is an error rather than a value
 * and an exhaustive `switch` or a `Record<FileOrigin, …>` stays available.
 */
export type FileOrigin = "chat" | "document";

export type StoredFile = {
  /**
   * Also the file's name on disk. A `randomUUID()` contains only hex and
   * dashes, so it cannot escape the directory it is written into — which is
   * the whole reason the uploaded name is never used as a path.
   */
  id: string;
  /** As uploaded. Shown to people and sent back on download; never a path. */
  name: string;
  /**
   * The MIME type the uploading client claimed. **Not trusted** — it is a
   * string an attacker chooses. What makes serving safe is the rule applied at
   * response time, not this value; see the download and preview routes.
   */
  type: string;
  /** Bytes. */
  size: number;
  /** The session's nickname at upload time, not a claim from the request. */
  uploadedBy: string;
  uploadedAt: string;
  origin: FileOrigin;
};

/** What a caller supplies; `id` and `uploadedAt` are the store's to assign. */
export type NewFile = Omit<StoredFile, "id" | "uploadedAt">;

/** Thrown when an id could not have been issued by this store. */
export class InvalidFileIdError extends Error {}
