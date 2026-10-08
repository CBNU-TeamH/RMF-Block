import { NextResponse } from "next/server";

import { isHost } from "@/lib/auth/current-member";
import { DocumentNotFoundError, restoreDocument } from "@/lib/documents/documents";
import { wsHub } from "@/server/ws-hub.mts";

/** Restores a deleted document, subtree and files, from the host's trash. Host
 *  only: a guest's delete is a delete, and getting it back is the host's call. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isHost())) {
    return NextResponse.json({ error: "호스트만 할 수 있습니다." }, { status: 401 });
  }

  const { id } = await params;
  let restored;
  try {
    restored = restoreDocument(id);
  } catch (error) {
    if (error instanceof DocumentNotFoundError) {
      return NextResponse.json({ error: "휴지통에 없는 문서입니다." }, { status: 404 });
    }
    throw error;
  }

  // Parent first, so a client's tree always has the parent a child names.
  for (const document of restored) wsHub.broadcast("document:created", { document });

  // Nothing to do for the files: they follow the catalogue (`FileRepository.list`).
  return NextResponse.json({ ids: restored.map((document) => document.id) });
}
