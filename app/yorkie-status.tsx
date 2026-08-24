"use client";

import yorkie from "@yorkie-js/sdk";
import { useEffect, useState } from "react";

type Status =
  | { state: "connecting" }
  | { state: "active"; address: string }
  | { state: "failed"; address: string; reason: string };

/**
 * Proof that the whole chain works: joined, session accepted, and this browser
 * can reach Yorkie (FR-020-04's "입장" is only real if sync is available).
 *
 * A placeholder for the workspace screen, not a design — activating and
 * deactivating a client is the smallest thing that answers "is Yorkie reachable
 * from *this* device", which is the question a guest on the LAN actually has.
 *
 * The host comes from the page's own URL, never from the server. Whatever
 * address someone typed to reach the app is one they can reach; being handed a
 * different one is what broke this on the desktop, where a page at
 * `localhost:3000` was told to fetch the LAN address and every browser refused
 * to cross out of the loopback address space.
 */
export function YorkieStatus({
  override,
  port,
}: {
  override: string | null;
  port: number;
}) {
  const [status, setStatus] = useState<Status>({ state: "connecting" });

  useEffect(() => {
    // Resolved in here, not in render: `window` does not exist while this
    // component renders on the server. It is kept on the resolved status rather
    // than in its own state so nothing sets state synchronously on mount.
    const address =
      override ?? `${window.location.protocol}//${window.location.hostname}:${port}`;

    const client = new yorkie.Client({ rpcAddr: address });
    let cancelled = false;

    client
      .activate()
      .then(() => {
        if (!cancelled) setStatus({ state: "active", address });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus({
          state: "failed",
          address,
          reason: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
      // Leaves no half-open client behind on a Fast Refresh or a navigation.
      // Deactivating a client that never activated rejects, and there is
      // nothing left to report by then.
      client.deactivate().catch(() => undefined);
    };
  }, [override, port]);

  if (status.state === "connecting") {
    return <p className="text-sm text-zinc-500">Connecting to Yorkie…</p>;
  }

  if (status.state === "failed") {
    return (
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          Yorkie is not reachable at {status.address}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{status.reason}</p>
      </div>
    );
  }

  return (
    <p className="text-sm font-medium text-green-600 dark:text-green-400">
      Yorkie client active — {status.address}
    </p>
  );
}
