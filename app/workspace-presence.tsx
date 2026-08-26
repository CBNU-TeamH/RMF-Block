"use client";

import yorkie from "@yorkie-js/sdk";
import { useEffect, useState } from "react";

import { rosterFrom } from "@/lib/presence/roster";
import { WORKSPACE_DOC_KEY, type WorkspacePresence } from "@/lib/presence/types";

type Connection =
  | { state: "connecting" }
  | { state: "active"; address: string }
  | { state: "failed"; address: string; reason: string };

/**
 * The connected-user list (FR-020-06/07), and the proof that this browser can
 * reach Yorkie at all — one component because they are one connection.
 *
 * Attaching to the workspace document *is* the act of being present: Yorkie
 * publishes `DocWatched` to the other clients on attach and `DocUnwatched` when
 * the watch stream ends, whether that was a clean detach, a closed tab, or Wi-Fi
 * dropping. Nothing here polls, and nothing here has to notice a disconnect.
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
export function WorkspacePresenceList({
  memberId,
  nickname,
  colorTag,
  override,
  port,
}: {
  memberId: string;
  nickname: string;
  colorTag: string;
  override: string | null;
  port: number;
}) {
  const [connection, setConnection] = useState<Connection>({ state: "connecting" });
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

    client
      .activate()
      .then(() =>
        client.attach(doc, {
          initialPresence: { id: memberId, nickname, colorTag },
        }),
      )
      .then(() => {
        if (cancelled) return;
        // Subscribed before the first read so an arrival between the two is not
        // missed. `others` covers all three of watched, unwatched, and a peer
        // changing their own presence.
        unsubscribe = doc.subscribe("others", readRoster);
        setConnection({ state: "active", address });
        readRoster();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setConnection({
          state: "failed",
          address,
          reason: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
      // Detaches every document this client holds, which is what tells the other
      // browsers to drop this member. Deactivating a client that never activated
      // rejects, and there is nothing left to report by then.
      client.deactivate().catch(() => undefined);
    };
  }, [memberId, nickname, colorTag, override, port]);

  if (connection.state === "failed") {
    return (
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          Yorkie is not reachable at {connection.address}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{connection.reason}</p>
      </div>
    );
  }

  if (connection.state === "connecting") {
    return <p className="text-sm text-zinc-500">Connecting to Yorkie…</p>;
  }

  return (
    <section className="w-full max-w-xs">
      <h2 className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
        In this workspace ({members.length})
      </h2>
      <ul className="mt-2 flex flex-col gap-1">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center gap-2 text-sm text-black dark:text-zinc-50"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: member.colorTag }}
            />
            <span className="truncate">{member.nickname}</span>
            {member.id === memberId ? (
              <span className="text-xs text-zinc-500">(you)</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
