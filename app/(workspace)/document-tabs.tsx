"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { WorkspaceDocument } from "@/lib/documents/documents";
import { documentIdFromPathname } from "@/lib/focus/pathname";
import { NO_TABS, STORAGE_KEY, closeTab, landingId, moveTab, openTab, parseTabs, type Tabs } from "@/lib/tabs";

import { useNewDocument } from "./new-document";
import { confirmClass, icon } from "./ui";

function readTabs(): Tabs {
  try {
    return parseTabs(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return NO_TABS;
  }
}

function writeTabs(tabs: Tabs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch {
    // Unavailable or full: the tabs still work, they just are not restored.
  }
}

/**
 * The open documents as tabs over `<main>` (#168). A tab is only a way back to a
 * document: the active one is the route, the one document mounted and
 * attached, so presence and everything built on "one document per route" are
 * untouched. Any navigation to a document opens its tab — the sidebar, a new
 * document, a follow, a jump.
 */
export function DocumentTabs({ documents }: { documents: Array<WorkspaceDocument> }) {
  const router = useRouter();
  const currentId = documentIdFromPathname(usePathname());
  // `null` until read: the server has no `localStorage`.
  const [tabs, setTabs] = useState<Tabs | null>(null);
  // The route this has already opened a tab for. Opening on a *change* of route,
  // not on "the route is not a tab", is what lets the active tab close: the
  // route still names it until the navigation to its neighbour lands.
  const [seenId, setSeenId] = useState<string | null>(null);
  const dragged = useRef<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-time read of browser-only state
    setTabs(readTabs());
  }, []);

  useEffect(() => {
    if (tabs) writeTabs(tabs);
  }, [tabs]);

  const byId = new Map(documents.map((doc) => [doc.id, doc]));

  // Adjusted during render, like `DocumentList`'s re-seed.
  if (tabs && currentId !== seenId) {
    setSeenId(currentId);
    if (currentId) setTabs(openTab(tabs, currentId));
  }

  // Deleted documents stay in the stored list until a close drops them; they
  // are only never shown.
  const shown = (tabs?.open ?? []).flatMap((id) => byId.get(id) ?? []);
  if (!tabs || shown.length === 0) return null;

  function close(id: string) {
    if (!tabs) return;
    // Over the tabs shown, so the neighbour moved to is never a deleted one.
    const rest = closeTab({ ...tabs, open: shown.map((doc) => doc.id) }, id);
    setTabs(rest);
    if (rest.active && rest.active !== tabs.active) router.push(`/documents/${rest.active}`);
  }

  function drop(event: React.DragEvent<HTMLLIElement>, index: number) {
    event.preventDefault();
    const id = dragged.current;
    dragged.current = null;
    if (!tabs || !id) return;
    // Past a tab's middle means after it, as a browser's tab strip does.
    const box = event.currentTarget.getBoundingClientRect();
    const after = event.clientX > box.left + box.width / 2;
    setTabs(moveTab(tabs, id, after ? (shown[index + 1]?.id ?? null) : shown[index].id));
  }

  return (
    // Tabs share the width and shrink as more open, as a browser's do; only
    // past their minimum does the strip scroll.
    <nav aria-label="열린 문서" className="flex-none border-b border-line px-2">
      <ul className="flex h-9 items-end gap-px overflow-x-auto">
        {shown.map((doc, index) => {
          const active = doc.id === currentId;
          return (
            <li
              key={doc.id}
              draggable
              onDragStart={(event) => {
                dragged.current = doc.id;
                event.dataTransfer.effectAllowed = "move";
                // Firefox starts no drag without data.
                event.dataTransfer.setData("text/plain", doc.id);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, index)}
              className={`group/tab flex h-8 max-w-[200px] min-w-[72px] flex-1 basis-0 items-center rounded-t-control border border-b-0 text-[13px] ${
                active ? "border-line bg-paper font-semibold text-ink" : "border-transparent text-ink-soft hover:bg-hover"
              }`}
            >
              {/* `draggable={false}`: an anchor drags its URL by default, which
                  would start that drag instead of the tab's. */}
              <Link
                href={`/documents/${doc.id}`}
                draggable={false}
                aria-current={active ? "page" : undefined}
                title={doc.name}
                className="min-w-0 flex-1 truncate py-1.5 pl-2.5 outline-none focus-visible:ring-2 focus-visible:ring-sky-deep focus-visible:ring-inset"
              >
                {doc.name}
              </Link>
              {/* The last tab has none: closing it would leave nothing to show,
                  and `/` would only land back on it. */}
              {shown.length > 1 ? (
                <button
                  type="button"
                  aria-label={`${doc.name} 닫기`}
                  onClick={() => close(doc.id)}
                  className={`mr-1 flex size-5 flex-none items-center justify-center rounded text-ink-faint hover:bg-hover hover:text-ink focus-visible:opacity-100 ${
                    active ? "" : "opacity-0 group-hover/tab:opacity-100"
                  }`}
                >
                  {icon(<path d="M4 4l8 8M12 4l-8 8" />, 10)}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * `/` is a landing, not a home (#168): it goes straight to the last document
 * this browser showed, else the first one in the tree. Client-side because that
 * memory is in `localStorage`. Only an empty workspace stays here.
 */
export function Landing({ documents }: { documents: Array<WorkspaceDocument> }) {
  const router = useRouter();
  const openNewDocument = useNewDocument();

  useEffect(() => {
    const id = landingId(readTabs(), documents);
    if (id) router.replace(`/documents/${id}`);
  }, [documents, router]);

  if (documents.length > 0) return null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
      <p className="text-[17px] font-semibold text-ink">아직 문서가 없어요</p>
      <p className="text-[13px] text-ink-faint">첫 문서를 만들어 워크스페이스를 시작하세요.</p>
      <button
        type="button"
        onClick={() => openNewDocument(null)}
        className={`mt-3 ${confirmClass(false)}`}
      >
        새 문서
      </button>
    </div>
  );
}
