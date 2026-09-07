/** Files uploaded through chat (FR-060-02) or as a document file block
 *  (FR-022-13/14). One store, not two — `docs/design/api.md` §1. */

/** What FR-050-06 and FR-061-01 filter on — one store holds both, and only this
 *  tells them apart. A union, not a string, so a typo is a type error. */
export type FileOrigin = "chat" | "document";

export type StoredFile = {
  /** Also the name on disk: `randomUUID()` is hex and dashes only, so it cannot
   *  escape its directory — which is why the uploaded name never becomes a path. */
  id: string;
  /** As uploaded. Shown to people and sent back on download; never a path. */
  name: string;
  /** What the client claimed. **Not trusted** — safety comes from the rule the
   *  download and preview routes apply at response time, not from this. */
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
