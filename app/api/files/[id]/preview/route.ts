import { NextResponse } from "next/server";

import { currentMember } from "@/lib/auth/current-member";
import { fileRepository } from "@/lib/files/file-repository";
import { inlineImageHeaders, isInlineImageType } from "@/lib/files/serving";
import { InvalidFileIdError } from "@/lib/files/types";

/**
 * A file the browser may render in place — which today means an image, so a
 * chat bubble can hold `<img src=".../preview">` (FR-050-03, and the inline
 * half of FR-060-02).
 *
 * This is the endpoint that has to name a real type, so it is the one that can
 * be wrong. It refuses everything it cannot prove is safe: not an image on the
 * list, no preview. The rest of the reasoning is in `lib/files/serving.ts`.
 *
 * A refusal is 404 rather than 415, because "there is no preview of this" is
 * the true statement — the caller is not being told to retry with a different
 * `Accept`, and the file is perfectly fine to download.
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
  if (!file || !isInlineImageType(file.type)) {
    return NextResponse.json({ error: "no preview for this file" }, { status: 404 });
  }

  try {
    const bytes = await fileRepository.read(id);
    if (!bytes) {
      return NextResponse.json({ error: "no preview for this file" }, { status: 404 });
    }

    return new Response(new Uint8Array(bytes), { headers: inlineImageHeaders(file.type) });
  } catch (error) {
    if (error instanceof InvalidFileIdError) {
      return NextResponse.json({ error: "no preview for this file" }, { status: 404 });
    }
    throw error;
  }
}
