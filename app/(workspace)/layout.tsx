import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { SESSION_COOKIE } from "@/lib/auth/types";
import { readDocumentsOnce } from "./read-documents";
import { isHostSecret } from "@/lib/host-secret";
import { HOST_PRESENCE } from "@/lib/presence/types";
import { getWorkspaceName } from "@/lib/workspace-config";
import { yorkieClientConfig } from "@/lib/yorkie-address";

import { SessionWatch } from "../session-watch";
import { Breadcrumb } from "./breadcrumb";
import { ChatWindow } from "./chat-window";
import { DocumentList } from "./document-list";
import { FloatingViewProvider } from "./floating-views";
import { FocusFollowProvider } from "./focus-follow-provider";
import { FocusShare } from "./focus-share";
import { PresenceProvider } from "./presence-provider";
import { PresenceStack } from "./presence-stack";

/**
 * The workspace shell — the sidebar document tree and the header of
 * `docs/ui/redesign/HANDOFF.md`, shared by every screen inside the route group.
 * A layout because Next keeps it mounted across navigations, so the tree keeps
 * its socket, scroll and collapsed state while documents open.
 *
 * `(workspace)` is a route group, so this adds a frame without adding a path
 * segment: the page inside it is still `/`. `app/join/` stays outside, which is
 * what keeps the join screen free of the shell.
 *
 * The auth gate lives here rather than in the page so every screen in the group
 * inherits it. FR-020-03/04: no session and no host cookie means the join form.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const isHost = isHostSecret(jar.get("role")?.value);
  const member = sessionRegistry.resolve(jar.get(SESSION_COOKIE)?.value);

  if (!isHost && !member) {
    redirect("/join");
  }

  // Only the port and an optional override — the host is the browser's own, so
  // it matches however this visitor reached the app. See `lib/yorkie-address.ts`.
  const yorkie = yorkieClientConfig();
  // The host proved themselves with the bootstrap secret and never filled in a
  // join form, so they have no `WorkspaceMember` to publish — see `HOST_PRESENCE`.
  const me = member ?? HOST_PRESENCE;
  const workspaceName = getWorkspaceName();
  const documents = readDocumentsOnce();

  return (
    <PresenceProvider
      colorTag={me.colorTag}
      memberId={me.id}
      nickname={me.nickname}
      override={yorkie.override}
      port={yorkie.port}
    >
      <FocusFollowProvider>
        <FloatingViewProvider colorTag={me.colorTag} nickname={me.nickname}>
          {/* `h-full` for the same reason `app/layout.tsx`'s body carries it: the
              shell has to be exactly the viewport's height, not merely at least
              it, or the row below never bounds `<main>` and the editor's own
              scroll container grows to fit its blocks instead of scrolling. */}
          <div className="flex h-full flex-1 bg-paper">
            {member ? <SessionWatch /> : null}

            <aside className="flex w-[260px] flex-none flex-col border-r border-line bg-paper-2 px-1.5 pt-2">
              <div className="mb-1 flex h-9 items-center gap-2 px-2">
                <span
                  aria-hidden
                  className="flex size-5 items-center justify-center rounded-[5px] bg-ink text-[11px] font-bold text-paper"
                >
                  r
                </span>
                <span className="truncate font-semibold text-ink">{workspaceName}</span>
              </div>
              <DocumentList documents={documents} />
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-[46px] flex-none items-center gap-2 pr-2.5 pl-4">
                <Breadcrumb documents={documents} />
                <PresenceStack memberId={me.id} />
                <FocusShare memberId={me.id} />
              </header>
              <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
            </div>

            {/* `fixed` — it floats over the shell rather than taking a column from it. */}
            <ChatWindow me={me.nickname} />
          </div>
          </FloatingViewProvider>
      </FocusFollowProvider>
    </PresenceProvider>
  );
}
