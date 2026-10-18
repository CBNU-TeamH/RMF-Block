import { FileManager } from "./file-manager";

/** The workspace file manager (UC-050). The list comes from `GET /api/files`,
 *  which checks the caller itself — `docs/design/file-manager.md`. */
export default function FilesPage() {
  return <FileManager />;
}
