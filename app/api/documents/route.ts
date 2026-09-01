import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { SESSION_COOKIE } from "@/lib/auth/types";
import { createDocument, DocumentValidationError } from "@/lib/documents/documents";
import { HOST_PRESENCE } from "@/lib/presence/types";
import { isHostSecret } from "@/lib/host-secret";

/**
 * UC-021's 기본 흐름: creates a document and adds it to the workspace's catalogue
 * (`lib/documents/documents.ts`). Yorkie is not touched here — the document's
 * content is seeded with its first block the moment the editor opens it
 * (`tasks/active/20260829-block-editor-todo.md` milestone 1), not at this call,
 * so creating one never has to reach Yorkie at all.
 *
 * Every member may create a document (SIR003's "모든 참가 사용자가 문서를 생성할
 * 수 있다"), the host included — hence the same `role` fallback `layout.tsx` uses
 * for `HOST_PRESENCE`, since the host has no guest session to resolve.
 */
export async function POST(request: NextRequest) {
  const jar = await cookies();
  const member = sessionRegistry.resolve(jar.get(SESSION_COOKIE)?.value);
  const isHost = isHostSecret(jar.get("role")?.value);

  if (!member && !isHost) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청을 읽을 수 없습니다." }, { status: 400 });
  }

  // `null`, a bare number, a string — all parse as valid JSON, so `.json()`
  // does not throw and the property read below would, outside the catch
  // above. That turned a malformed request into a 500 instead of the 400 it
  // is.
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "요청을 읽을 수 없습니다." }, { status: 400 });
  }

  const { name: rawName } = body as { name?: unknown };
  const name = typeof rawName === "string" ? rawName : undefined;
  const createdBy = member?.id ?? HOST_PRESENCE.id;

  try {
    const document = createDocument(name, createdBy);
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("document creation failed", error);
    return NextResponse.json(
      { error: "문서를 만들지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
