import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { SESSION_COOKIE } from "@/lib/auth/types";
import { readDocumentsOnce } from "./read-documents";
import { isHostSecret } from "@/lib/host-secret";
import { HOST_PRESENCE } from "@/lib/presence/types";
import { getWorkspaceName, isWorkspaceOpen } from "@/lib/workspace-config";
import { yorkieClientConfig } from "@/lib/yorkie-address";

import { SessionWatch } from "../session-watch";
import { Breadcrumb } from "./breadcrumb";
import { ChatWindow } from "./chat-window";
import { DocumentList } from "./document-list";
import { DocumentTabs } from "./document-tabs";
import { FloatingViewProvider } from "./floating-views";
import { FocusFollowProvider } from "./focus-follow-provider";
import { FocusShare } from "./focus-share";
import { NewDocumentProvider } from "./new-document";
import { PresenceProvider } from "./presence-provider";
import { PresenceStack } from "./presence-stack";
import { Sidebar } from "./sidebar";
import { DOCUMENT_ACTIONS_ID, SIDEBAR_COOKIE } from "./ui";

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

  // UC-010: the host's first stop is the setup screen.
  if (isHost && !isWorkspaceOpen()) {
    redirect("/admin");
  }

  // Only the port and an optional override — the host is the browser's own, so
  // it matches however this visitor reached the app. See `lib/yorkie-address.ts`.
  const yorkie = yorkieClientConfig();
  // The host proved themselves with the bootstrap secret and never filled in a
  // join form, so they have no `WorkspaceMember` to publish — see `HOST_PRESENCE`.
  const me = member ?? HOST_PRESENCE;
  const workspaceName = getWorkspaceName();
  const documents = readDocumentsOnce();
  // Only the identity fields: `lastJoinedAt` has no business in the client payload.
  const known = sessionRegistry.members().map(({ id, nickname, colorTag }) => ({ id, nickname, colorTag }));

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
          <NewDocumentProvider>
            {/* `h-full` for the same reason `app/layout.tsx`'s body carries it: the
                shell has to be exactly the viewport's height, not merely at least
                it, or the row below never bounds `<main>` and the editor's own
                scroll container grows to fit its blocks instead of scrolling. */}
            <div className="flex h-full flex-1 bg-paper">
              {member ? <SessionWatch /> : null}

              <Sidebar
                workspaceName={workspaceName}
                isHost={isHost}
                initiallyCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "collapsed"}
              >
                <DocumentList documents={documents} />
              </Sidebar>

              <div className="flex min-w-0 flex-1 flex-col">
                {/* Tabs outermost, then one bar for the document they show — its
                    path, who is in it, and its actions — as Obsidian, Notion and
                    wafflebase arrange it (`app-shell.md`). */}
                <DocumentTabs documents={documents} />
                <header className="flex h-[46px] flex-none items-center gap-2 pr-2.5 pl-4">
                  <Breadcrumb documents={documents} />
                  <PresenceStack memberId={me.id} known={known} />
                  <FocusShare memberId={me.id} />
                  <div id={DOCUMENT_ACTIONS_ID} className="flex items-center empty:hidden" />
                </header>
                <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
              </div>

              {/* `fixed` — it floats over the shell rather than taking a column from it. */}
              <ChatWindow me={me.nickname} />
            </div>
          </NewDocumentProvider>
        </FloatingViewProvider>
      </FocusFollowProvider>
    </PresenceProvider>
  );
}
