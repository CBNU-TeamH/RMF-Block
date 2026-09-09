import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { SESSION_COOKIE } from "@/lib/auth/types";
import {
  DocumentNotFoundError,
  DocumentValidationError,
  deleteDocument,
  moveDocument,
  readDocuments,
  renameDocument,
} from "@/lib/documents/documents";
import { isHostSecret } from "@/lib/host-secret";
import { wsHub } from "@/server/ws-hub.mts";

/**
 * Rename, move and delete one document (FR-023-01~06).
 *
 * Every write broadcasts, which is FR-023-07's "실시간으로 반영" — the catalogue
 * lives in `.data/`, not Yorkie (`docs/design/architecture.md` §3(d)), so the
 * hub is what carries a change to the other clients. `chat:message` was the
 * first caller of a broadcaster written to be reusable; this is the second.
 */
async function requireMember() {
  const jar = await cookies();
  const member = sessionRegistry.resolve(jar.get(SESSION_COOKIE)?.value);

  return Boolean(member) || isHostSecret(jar.get("role")?.value);
}

/** One document's catalogue row. What a `doc-link` block reads to show a name:
 *  the block stores only an id, and the name is this file's to answer because
 *  FR-023-01 can change it. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireMember())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const document = readDocuments().find((candidate) => candidate.id === id);

  // 404 rather than an empty body: a link to a deleted document is a state the
  // block renders, and it needs to be able to tell that from a slow answer.
  if (!document) {
    return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ document });
}

/** `PATCH` carries either a `name` or a `parentId`, never both: they are two
 *  operations with different collision rules (FR-023-02 refuses a name clash,
 *  a move suffixes one), and one request doing both would have to pick. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireMember())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청을 읽을 수 없습니다." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "요청을 읽을 수 없습니다." }, { status: 400 });
  }

  const { name, parentId } = body as { name?: unknown; parentId?: unknown };
  const renaming = typeof name === "string";
  const moving = parentId === null || typeof parentId === "string";

  if (renaming === moving) {
    return NextResponse.json(
      { error: "이름 변경과 이동 중 하나만 요청할 수 있습니다." },
      { status: 400 },
    );
  }

  try {
    const document = renaming
      ? renameDocument(id, name)
      : moveDocument(id, parentId as string | null);

    wsHub.broadcast("document:changed", { document });

    return NextResponse.json({ document });
  } catch (error) {
    return failure(error, "문서를 수정하지 못했습니다.");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireMember())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Every id, not just the one asked for: FR-023-06 takes the subtree, and a
    // client that only heard about the parent would keep drawing its children.
    const removedIds = deleteDocument(id);

    wsHub.broadcast("document:deleted", { ids: removedIds });

    return NextResponse.json({ ids: removedIds });
  } catch (error) {
    return failure(error, "문서를 삭제하지 못했습니다.");
  }
}

function failure(error: unknown, fallback: string) {
  if (error instanceof DocumentNotFoundError) {
    return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
  }
  if (error instanceof DocumentValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
