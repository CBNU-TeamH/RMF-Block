"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { useNewDocument } from "./new-document";
import { AdminIcon, PLUS, SEARCH, SIDEBAR_COOKIE, icon } from "./ui";

const railButton =
  "flex size-8 items-center justify-center rounded-control text-ink-soft hover:bg-hover hover:text-ink";

/**
 * The sidebar, collapsible to a rail of icons (#168). Collapsed, the tree is
 * hidden, never unmounted: its socket is what keeps the catalogue — and so the
 * breadcrumb and the tab names — current.
 */
export function Sidebar({
  workspaceName,
  isHost,
  initiallyCollapsed,
  children,
}: {
  workspaceName: string;
  isHost: boolean;
  initiallyCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const asideRef = useRef<HTMLElement>(null);
  const openNewDocument = useNewDocument();

  function toggle(next: boolean, focusSearch = false) {
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
    // By its label, so another field added to the sidebar cannot take its place.
    if (focusSearch) {
      requestAnimationFrame(() =>
        asideRef.current?.querySelector<HTMLInputElement>('input[aria-label="문서 제목 검색"]')?.focus(),
      );
    }
  }

  const logo = (
    <span
      aria-hidden
      className="flex size-5 flex-none items-center justify-center rounded-[5px] bg-ink text-[11px] font-bold text-paper"
    >
      r
    </span>
  );

  return (
    <aside
      ref={asideRef}
      className={`flex flex-none flex-col border-r border-line bg-paper-2 pt-2 ${
        collapsed ? "w-12 items-center gap-1 px-1" : "w-[260px] px-1.5"
      }`}
    >
      {collapsed ? (
        <>
          <span className="flex h-9 items-center" title={workspaceName}>
            {logo}
          </span>
          <button type="button" aria-label="사이드바 펼치기" onClick={() => toggle(false)} className={railButton}>
            {icon(<path d="M6 4l4 4-4 4" />, 16)}
          </button>
          <button type="button" aria-label="검색" onClick={() => toggle(false, true)} className={railButton}>
            {icon(SEARCH, 16)}
          </button>
          <button type="button" aria-label="새 문서" onClick={() => openNewDocument(null)} className={railButton}>
            {icon(PLUS, 16)}
          </button>
        </>
      ) : (
        <div className="mb-1 flex h-9 items-center gap-2 px-2">
          {logo}
          <span className="min-w-0 flex-1 truncate font-semibold text-ink">{workspaceName}</span>
          <button
            type="button"
            aria-label="사이드바 접기"
            onClick={() => toggle(true)}
            className="-mr-1 flex size-6 items-center justify-center rounded text-ink-faint hover:bg-hover hover:text-ink"
          >
            {icon(<path d="M10 4L6 8l4 4" />, 16)}
          </button>
        </div>
      )}
      <div className={collapsed ? "hidden" : "flex min-h-0 flex-1 flex-col"}>{children}</div>
      {/* Workspace-wide, so here rather than in the document bar — Notion's
          Settings spot. Host only; the page itself refuses anyone else. */}
      {isHost ? (
        <Link
          href="/admin"
          aria-label="관리자"
          title="관리자 페이지 — 호스트에게만 보입니다"
          className={
            collapsed
              ? `mt-auto mb-2 ${railButton}`
              : "mb-2 flex h-8 flex-none items-center gap-2 rounded-control px-2 text-ink-soft hover:bg-hover"
          }
        >
          <AdminIcon size={16} />
          {collapsed ? null : <span aria-hidden>관리자</span>}
        </Link>
      ) : null}
    </aside>
  );
}
