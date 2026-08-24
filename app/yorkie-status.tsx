"use client";

import yorkie from "@yorkie-js/sdk";
import { useEffect, useState } from "react";

type Status =
  | { state: "connecting" }
  | { state: "active" }
  | { state: "failed"; reason: string };

/**
 * Proof that the whole chain works: joined, session accepted, and this browser
 * can reach Yorkie (FR-020-04's "입장" is only real if sync is available).
 *
 * A placeholder for the workspace screen, not a design — activating and
 * deactivating a client is the smallest thing that answers "is Yorkie reachable
 * from *this* device", which is the question a guest on the LAN actually has.
 */
export function YorkieStatus({ address }: { address: string }) {
  const [status, setStatus] = useState<Status>({ state: "connecting" });

  useEffect(() => {
    const client = new yorkie.Client({ rpcAddr: address });
    let cancelled = false;

    client
      .activate()
      .then(() => {
        if (!cancelled) setStatus({ state: "active" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus({
          state: "failed",
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
  }, [address]);

  if (status.state === "connecting") {
    return <p className="text-sm text-zinc-500">Connecting to Yorkie…</p>;
  }

  if (status.state === "failed") {
    return (
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          Yorkie is not reachable at {address}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{status.reason}</p>
      </div>
    );
  }

  return (
    <p className="text-sm font-medium text-green-600 dark:text-green-400">
      Yorkie client active — {address}
    </p>
  );
}
