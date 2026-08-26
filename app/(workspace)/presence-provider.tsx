"use client";

import yorkie from "@yorkie-js/sdk";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { rosterFrom } from "@/lib/presence/roster";
import { WORKSPACE_DOC_KEY, type WorkspacePresence } from "@/lib/presence/types";

export type PresenceState =
  | { status: "connecting"; members: Array<WorkspacePresence> }
  | { status: "active"; members: Array<WorkspacePresence> }
  | { status: "failed"; members: Array<WorkspacePresence> };

const PresenceContext = createContext<PresenceState>({ status: "connecting", members: [] });

/** Read the workspace roster. Every consumer shares one Yorkie connection. */
export function useWorkspacePresence(): PresenceState {
  return useContext(PresenceContext);
}

/**
 * Owns the browser's single Yorkie connection and hands the roster down
 * (FR-020-06/07).
 *
 * Attaching to the workspace document *is* the act of being present: Yorkie
 * publishes `DocWatched` to the other clients on attach and `DocUnwatched` when
 * the watch stream ends, whether that was a clean detach, a closed tab, or Wi-Fi
 * dropping. Nothing here polls, and nothing here has to notice a disconnect.
 *
 * It is a provider rather than a component that renders the roster itself
 * because two things need the same list — the top bar's stack and the Members
 * screen — and two components each opening a `yorkie.Client` would mean two
 * connections per browser. Living in the workspace layout also keeps the
 * connection up across navigations inside the group: a per-page component would
 * detach and re-attach on every move, and everyone else would watch you leave
 * and rejoin.
 *
 * Identity arrives as three strings rather than one member object on purpose:
 * a fresh object every render would give the effect a new dependency every
 * render, and it would tear down and rebuild the Yorkie connection each time.
 *
 * The address comes from the page's own URL, never from the server. Whatever
 * host someone typed to reach the app is one they can reach; being handed a
 * different one is what broke this on the desktop, where a page at
 * `localhost:3000` was told to fetch the LAN address and every browser refused
 * to cross out of the loopback address space.
 */
export function PresenceProvider({
  memberId,
  nickname,
  colorTag,
  override,
  port,
  children,
}: {
  memberId: string;
  nickname: string;
  colorTag: string;
  override: string | null;
  port: number;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<PresenceState["status"]>("connecting");
  const [members, setMembers] = useState<Array<WorkspacePresence>>([]);

  useEffect(() => {
    // Resolved in here, not in render: `window` does not exist while this
    // component renders on the server.
    const address =
      override ?? `${window.location.protocol}//${window.location.hostname}:${port}`;

    const client = new yorkie.Client({ rpcAddr: address });
    const doc = new yorkie.Document<Record<string, never>, WorkspacePresence>(
      WORKSPACE_DOC_KEY,
    );

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    // Yorkie counts clients; the list shows people. `rosterFrom` is where the
    // two are reconciled, and it lives in `lib/` so that rule is tested without
    // a browser.
    const readRoster = () => setMembers(rosterFrom(doc.getPresences()));

    const setup = (async () => {
      await client.activate();
      // #32: cleanup during activate() returns immediately, because deactivate()
      // is a no-op on a client that is still Deactivated. Without this guard the
      // chain would go on to attach, start a watch stream, and leave this
      // browser present in everyone else's roster with nothing pointing at it.
      if (cancelled) return;

      await client.attach(doc, { initialPresence: { id: memberId, nickname, colorTag } });
      if (cancelled) return;

      // Subscribed before the first read so an arrival between the two is not
      // missed. `others` covers all three of watched, unwatched, and a peer
      // changing their own presence.
      unsubscribe = doc.subscribe("others", readRoster);
      setStatus("active");
      readRoster();
    })().catch((error: unknown) => {
      if (cancelled) return;
      setStatus("failed");
      // ponytail: the address and the reason go to the console until someone
      // asks for a real error surface. A 44px top bar has room for a state, not
      // for a stack trace, and this is the one place a guest can be told
      // anything at all about it.
      console.error(`Yorkie is not reachable at ${address}`, error);
      // ponytail: failed is terminal — the only way back is a reload. A quiet
      // retry with a backoff would fit here and is tracked as issue #37; it is
      // left out for now because nothing else in the app reconnects either, and
      // one component doing it alone would be the odd one out.
    });

    return () => {
      cancelled = true;
      // Tear down only once setup has settled. Doing it mid-flight is what left
      // a client attached with nothing pointing at it — the same shape
      // `app/spike/prosemirror/page.tsx` already uses.
      void setup.finally(() => {
        unsubscribe?.();
        // Detaches every document this client holds, which is what tells the
        // other browsers to drop this member.
        client.deactivate().catch(() => undefined);
      });
    };
  }, [memberId, nickname, colorTag, override, port]);

  const value = useMemo<PresenceState>(() => ({ status, members }), [status, members]);

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}
