import { NextResponse } from "next/server";

import { currentMember } from "@/lib/auth/current-member";
import { fileRepository } from "@/lib/files/file-repository";
import { attachmentHeaders } from "@/lib/files/serving";
import { InvalidFileIdError } from "@/lib/files/types";

/**
 * The original bytes (FR-050-04, FR-061-04, FR-080-05).
 *
 * Serves anything, and is safe because of what it refuses to do rather than
 * what it checks: the stored type is never read, so every response is an opaque
 * attachment no matter what was uploaded. See `lib/files/serving.ts`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await currentMember())) {
    return NextResponse.json({ error: "no workspace session" }, { status: 401 });
  }

  const { id } = await params;

  const file = await fileRepository.find(id);
  if (!file) {
    return NextResponse.json({ error: "no such file" }, { status: 404 });
  }

  try {
    const bytes = await fileRepository.read(id);
    // Metadata without bytes is a store that lost half of itself, not a request
    // to answer differently — but a 404 is still what the caller can do
    // something with.
    if (!bytes) {
      return NextResponse.json({ error: "no such file" }, { status: 404 });
    }

    return new Response(new Uint8Array(bytes), { headers: attachmentHeaders(file.name) });
  } catch (error) {
    // An id that reached `find()` came out of our own index, so this means the
    // id in the index is malformed rather than that the caller sent something
    // strange.
    if (error instanceof InvalidFileIdError) {
      return NextResponse.json({ error: "no such file" }, { status: 404 });
    }
    throw error;
  }
}
