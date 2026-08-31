/**
 * Files uploaded into the workspace — today only through chat (FR-060-02), and
 * `docs/design/api.md` §1 already points both FR-061-04 (chat) and FR-050-04
 * (documents) at the same `/api/files/:id/download`. One store rather than two,
 * with `origin` recording which side put a file there.
 */

/**
 * Where a file came from. One member today; document file blocks
 * (FR-022-13/14) become the second, and that is what FR-050-06 ("exclude files
 * whose block was deleted") and FR-061-01 will filter on.
 *
 * A union of one rather than a bare string. That does not make every reader
 * fail to compile when the second value lands — a plain `if (origin ===
 * "chat")` keeps compiling and silently drops document files. What it does buy
 * is a typo caught now (`"chatt"` is an error, not a value), and the option of
 * an exhaustive `switch` or a `Record<FileOrigin, …>` later, which a bare
 * `string` would rule out entirely.
 */
export type FileOrigin = "chat";

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
