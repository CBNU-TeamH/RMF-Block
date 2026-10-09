import { Landing } from "./document-tabs";
import { readDocumentsOnce } from "./read-documents";

/** No home page (#168): `/` lands on a document, and shows something of its own
 *  only in an empty workspace. */
export default function WorkspaceHome() {
  return <Landing documents={readDocumentsOnce()} />;
}
