"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WorkspaceDocument } from "@/lib/documents/documents";
import { documentIdFromPathname } from "@/lib/focus/pathname";

/**
 * The header's path to the open document: its ancestors, then itself
 * (`docs/ui/redesign/HANDOFF.md`). Nothing on the home page.
 *
 * ponytail: reads the layout's server-rendered list, so a rename or move made
 * by someone else shows here on the next navigation, not live — the sidebar
 * tree has the socket; lift its `live` state if that gap ever matters.
 */
export function Breadcrumb({ documents }: { documents: Array<WorkspaceDocument> }) {
  const currentId = documentIdFromPathname(usePathname());
  const byId = new Map(documents.map((doc) => [doc.id, doc]));

  const path: Array<WorkspaceDocument> = [];
  // `path.length` bounds the walk: a corrupt catalogue with a cycle would
  // otherwise loop forever.
  for (
    let doc = currentId ? byId.get(currentId) : undefined;
    doc && path.length < documents.length;
    doc = doc.parentId ? byId.get(doc.parentId) : undefined
  ) {
    path.unshift(doc);
  }

  return (
    <nav aria-label="문서 경로" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
      {path.map((doc, index) => {
        const last = index === path.length - 1;
        return (
          <span key={doc.id} className="flex min-w-0 items-center gap-0.5">
            {index > 0 ? <span className="px-0.5 text-ink-faint">/</span> : null}
            <Link
              href={`/documents/${doc.id}`}
              aria-current={last ? "page" : undefined}
              className={`truncate rounded-control px-1.5 py-0.5 hover:bg-hover ${
                last ? "text-ink" : "text-ink-soft"
              }`}
            >
              {doc.name}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
