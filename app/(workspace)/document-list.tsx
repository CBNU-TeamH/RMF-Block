"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { WorkspaceDocument } from "@/lib/documents/documents";
import { treeRows } from "@/lib/documents/tree";
import { documentIdFromPathname } from "@/lib/focus/pathname";
import { occupantsByDocument } from "@/lib/presence/roster";

import { DocumentActionDialog, type DocumentAction } from "./document-actions";
import { DocumentRowMenu } from "./document-row-menu";
import { useFocusFollow } from "./focus-follow-provider";
import { useNewDocument } from "./new-document";
import { useWorkspacePresence } from "./presence-provider";
import { FileIcon } from "./ui";

/** The sidebar's 16px line icons (`docs/ui/redesign/HANDOFF.md` §3). */
const icon = (path: React.ReactNode, size = 15) => (
  <svg
    aria-hidden
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {path}
  </svg>
);
const PLUS = <path d="M8 3v10M3 8h10" />;
/** Dots a row shows for the others in a document before folding into `+N`. */
const MAX_DOTS = 3;

/**
 * The workspace's document tree (FR-020-06, the document half) in the sidebar,
 * and where UC-021's 기본 흐름 starts.
 *
 * Rows navigate to `/documents/[id]`; "새 문서" opens the layout's dialog
 * (`new-document.tsx`).
 *
 * Client-side for the search box and the dialogs. The rows themselves arrive as
 * props from the layout, a server component, so the tree is in the HTML on
 * first paint.
 */
export function DocumentList({ documents }: { documents: Array<WorkspaceDocument> }) {
  const router = useRouter();
  const currentId = documentIdFromPathname(usePathname());
  const { members, memberId } = useWorkspacePresence();
  const { jumpTo } = useFocusFollow();
  // The one row whose `+N` is open, so its folded members can be jumped to too.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const occupants = useMemo(() => occupantsByDocument(members, memberId), [members, memberId]);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  // UC-023's three operations, or null for none open. One piece of state, not
  // one flag each: they are mutually exclusive by construction this way.
  const [action, setAction] = useState<DocumentAction | null>(null);
  const openDialog = useNewDocument();

  // The server component's list is the first paint; the socket keeps it current
  // from there (FR-021-06, FR-023-07).
  const [live, setLive] = useState(documents);
  // Re-seeded during render rather than in an effect, which is React's own
  // pattern for adjusting state when a prop changes — an effect that calls
  // `setState` synchronously renders twice for every `router.refresh()`, and
  // eslint refuses it.
  const [seeded, setSeeded] = useState(documents);
  if (seeded !== documents) {
    setSeeded(documents);
    setLive(documents);
  }

  useEffect(() => {
    // Same origin and port as the page, and the workspace path `server/index.mts`
    // routes to the hub — the shape `app/session-watch.tsx` already uses. `/ws`
    // is not a path this server upgrades.
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/workspace/ws`);

    socket.addEventListener("message", (event) => {
      let message: { event?: string; payload?: unknown };
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.event === "document:created" || message.event === "document:changed") {
        const { document } = message.payload as { document: WorkspaceDocument };
        setLive((current) => [document, ...current.filter((d) => d.id !== document.id)]);
      }

      if (message.event === "document:deleted") {
        const { ids } = message.payload as { ids: Array<string> };
        const gone = new Set(ids);
        setLive((current) => current.filter((d) => !gone.has(d.id)));
      }

      // The tree updates itself above; the layout's own read feeds the header
      // breadcrumb, which would otherwise keep the catalogue it first rendered.
      if (message.event?.startsWith("document:")) router.refresh();
    });

    return () => socket.close();
  }, [router]);

  const toggle = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  /**
   * The rows to draw. **A search flattens the tree on purpose**: a match three
   * levels down would otherwise be hidden behind two collapsed parents, and
   * showing its ancestors just to reach it buries the thing that matched.
   */
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle) {
      return live
        .filter((doc) => doc.name.toLowerCase().includes(needle))
        .map((document) => ({ document, depth: 0, hasChildren: false }));
    }
    return treeRows(live, collapsed);
  }, [live, query, collapsed]);


  const sideRow =
    "flex h-8 w-full items-center gap-2 rounded-control px-2 text-ink-soft hover:bg-hover";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-px">
        <label className={`${sideRow} cursor-text focus-within:bg-hover`}>
          {icon(
            <>
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </>,
            16,
          )}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="검색"
            aria-label="문서 제목 검색"
            className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-soft"
          />
        </label>
        <button type="button" onClick={() => openDialog(null)} className={sideRow}>
          {icon(PLUS, 16)}새 문서
        </button>
      </div>

      <div className="mx-2 mt-[18px] mb-1 flex items-baseline gap-1.5 text-xs font-semibold text-ink-faint">
        문서
        <span className="font-normal">{live.length}</span>
      </div>

      {rows.length === 0 ? (
        <p className="px-2 py-3 text-[13px] text-ink-faint">
          {live.length === 0 ? "아직 문서가 없어요" : `'${query}'와 일치하는 문서가 없어요`}
        </p>
      ) : (
        <ul className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-1.5 pb-2">
          {rows.map(({ document: doc, depth, hasChildren }) => {
            const current = doc.id === currentId;
            const here = occupants.get(doc.id) ?? [];
            return (
              <li key={doc.id} className="group/row relative">
                <Link
                  href={`/documents/${doc.id}`}
                  aria-current={current ? "page" : undefined}
                  style={{ paddingLeft: 4 + depth * 14 }}
                  className={`flex h-8 items-center gap-1 rounded-control pr-24 outline-none focus-visible:ring-2 focus-visible:ring-sky-deep focus-visible:ring-inset ${
                    current ? "bg-sky-soft font-semibold text-ink" : "font-medium text-ink-soft hover:bg-hover"
                  }`}
                >
                  {hasChildren ? (
                    // The chevron's slot; the button itself sits beside the
                    // link below, since an anchor can't hold another control.
                    <span aria-hidden className="size-5 shrink-0" />
                  ) : (
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center ${
                        current ? "text-sky-text" : "text-ink-faint"
                      }`}
                    >
                      <FileIcon size={15} />
                    </span>
                  )}
                  <span className="truncate">{doc.name}</span>
                </Link>

                {/* UC-040: who else is in this document; a dot jumps to them. Beside
                  * the `<Link>`, not in it — a button inside an anchor is invalid
                  * HTML. `right-14` clears the hover-only row actions. */}
                {here.length > 0 ? (
                  <span className="absolute inset-y-0 right-14 flex items-center gap-0.5">
                    {(expandedId === doc.id ? here : here.slice(0, MAX_DOTS)).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        title={`${m.nickname}에게 이동`}
                        aria-label={`${m.nickname}에게 이동`}
                        onClick={() => jumpTo(m.id)}
                        style={{ backgroundColor: m.colorTag }}
                        className="size-3.5 rounded-full outline-none hover:ring-2 hover:ring-sky-deep focus-visible:ring-2 focus-visible:ring-sky-deep"
                      />
                    ))}
                    {here.length > MAX_DOTS ? (
                      <button
                        type="button"
                        aria-expanded={expandedId === doc.id}
                        title={here.slice(MAX_DOTS).map((m) => m.nickname).join(", ")}
                        onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                        className="rounded px-0.5 text-[10px] font-semibold text-ink-faint outline-none hover:bg-sky-soft focus-visible:ring-2 focus-visible:ring-sky-deep"
                      >
                        {expandedId === doc.id ? "접기" : `+${here.length - MAX_DOTS}`}
                      </button>
                    ) : null}
                  </span>
                ) : null}

                {hasChildren ? (
                  <button
                    type="button"
                    aria-label={collapsed.has(doc.id) ? "펼치기" : "접기"}
                    aria-expanded={!collapsed.has(doc.id)}
                    onClick={() => toggle(doc.id)}
                    style={{ left: 4 + depth * 14 }}
                    className="absolute top-1.5 flex size-5 items-center justify-center rounded text-ink-faint outline-none hover:bg-sky-soft focus-visible:ring-2 focus-visible:ring-sky-deep"
                  >
                    <svg
                      aria-hidden
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform duration-[120ms] ${collapsed.has(doc.id) ? "" : "rotate-90"}`}
                    >
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </button>
                ) : null}

                {/* Outside the `<Link>`, not inside it: a button nested in an
                  * anchor is invalid HTML, and the browser's own fix for it is
                  * to close the anchor early. Hover-only (HANDOFF §3), and kept
                  * up while its menu is open. Centred with flex, never a
                  * transform: a transform on an ancestor would become the
                  * containing block for the menu's `position: fixed`. */}
                <span className="absolute inset-y-0 right-1 flex items-center gap-px opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 has-[[aria-expanded=true]]:opacity-100">
                  <DocumentRowMenu
                    label={doc.name}
                    items={[
                      { label: "하위 문서 추가", icon: icon(PLUS), onSelect: () => openDialog(doc.id) },
                      {
                        label: "이름 변경",
                        icon: icon(<path d="M10.5 3l2.5 2.5L6 12.5H3.5V10z" />),
                        onSelect: () => setAction({ kind: "rename", document: doc }),
                      },
                      {
                        label: "이동",
                        icon: icon(<path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" />),
                        onSelect: () => setAction({ kind: "move", document: doc }),
                      },
                      {
                        label: "삭제",
                        danger: true,
                        icon: icon(<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5" />),
                        onSelect: () => setAction({ kind: "delete", document: doc }),
                      },
                    ]}
                  />
                  <button
                    type="button"
                    aria-label={`${doc.name} 안에 새 문서`}
                    onClick={() => openDialog(doc.id)}
                    className="flex size-[22px] items-center justify-center rounded text-ink-faint hover:bg-sky-soft hover:text-ink"
                  >
                    {icon(PLUS, 14)}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <DocumentActionDialog
        action={action}
        documents={live}
        onClose={() => setAction(null)}
        // The socket has already updated `live` for this browser too; this
        // keeps the layout's own read from going stale behind it.
        onDone={() => router.refresh()}
      />
    </div>
  );
}
