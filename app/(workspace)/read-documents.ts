import { redirect } from "next/navigation";
import { cache } from "react";

import { currentMember } from "@/lib/auth/current-member";
import { readDocuments } from "@/lib/documents/documents";

/** The catalogue, once per request, and only for someone signed in: the layout's
 *  gate does not stop a page rendered beside it from reading this (#203). */
export const readDocumentsOnce = cache(async () => {
  if (!(await currentMember())) redirect("/join");
  return readDocuments();
});
