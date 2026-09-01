import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionRegistry } from "@/lib/auth/session-registry";
import { SESSION_COOKIE } from "@/lib/auth/types";
import { isHostSecret } from "@/lib/host-secret";
import { HOST_PRESENCE } from "@/lib/presence/types";
import { getWorkspaceName } from "@/lib/workspace-config";
import { yorkieClientConfig } from "@/lib/yorkie-address";

import { SessionWatch } from "../session-watch";
import { ChatWindow } from "./chat-window";
import { PresenceProvider } from "./presence-provider";
import { PresenceStack } from "./presence-stack";

/** Phase 2 owns these three; a nav item that looks clickable and is not is
 * worse than one that says it is not yet. */
const NAV = [
  { icon: "⊙", label: "WorkSpace overview", current: true },
  { icon: "👥", label: "Members" },
  { icon: "🗄", label: "Storage" },
  { icon: "⚙", label: "Settings" },
];

/**
 * The workspace shell — `dashboard.dc.html` screen 2's frame, shared by every
 * screen inside the route group. A layout rather than a `<TopBar />` because
 * the artboard's Members, Storage and Settings screens sit in this same frame,
 * and Next keeps a layout mounted across navigations between them.
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

  return (
    <PresenceProvider
      colorTag={me.colorTag}
      memberId={me.id}
      nickname={me.nickname}
      override={yorkie.override}
      port={yorkie.port}
    >
      <div className="flex min-h-full flex-1 flex-col bg-shell">
        {member ? <SessionWatch /> : null}

        <header className="flex h-11 flex-none items-center gap-3 border-b border-ink bg-paper px-4">
          <span className="text-sm font-semibold text-ink">{workspaceName}</span>
          <span className="flex-1" />
          <PresenceStack memberId={me.id} />
        </header>

        <div className="flex min-h-0 flex-1">
          <nav className="flex w-50 flex-none flex-col border-r border-ink bg-paper">
            <div className="border-b border-ink/60 px-3 py-2 text-sm font-bold text-ink">
              {workspaceName}
            </div>
            <ul className="flex flex-col gap-0.5 p-2">
              {NAV.map((item) => (
                <li key={item.label}>
                  <span
                    aria-current={item.current ? "page" : undefined}
                    className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-sm ${
                      item.current
                        ? "bg-sky-soft font-bold text-ink"
                        : "text-ink-faint line-through decoration-ink-faint/50"
                    }`}
                  >
                    <span aria-hidden>{item.icon}</span>
                    {item.label}
                    {/* `aria-disabled` on a bare span is a no-op — the attribute
                        only means anything on a role that has a disabled state.
                        The strikethrough says "not yet" to sighted readers; this
                        says it to everyone else. */}
                    {item.current ? null : <span className="sr-only">(준비 중)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </nav>

          <main className="min-w-0 flex-1 overflow-hidden bg-paper px-8 py-7">{children}</main>
        </div>

        {/* Outside the row, and `fixed` — it floats over the shell rather than
            taking a column from it. */}
        <ChatWindow me={me.nickname} />
      </div>
    </PresenceProvider>
  );
}
