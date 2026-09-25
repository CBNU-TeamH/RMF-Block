import { cache } from "react";

import { readDocuments } from "@/lib/documents/documents";

/** One catalogue read per request: the layout (sidebar) and the document page
 *  both need it, and `readDocuments()` is a synchronous file read and sort. */
export const readDocumentsOnce = cache(() => readDocuments());
