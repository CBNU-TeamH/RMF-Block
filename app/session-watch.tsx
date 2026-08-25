"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Leaves the workspace when this device's session is displaced (FR-020-08).
 *
 * Signing in under the same nickname somewhere else makes that device the live
 * one. This socket is how the server reaches the old device to say so — without
 * it, a laptop would sit on a workspace it is no longer part of until someone
 * happened to click something.
 */
export function SessionWatch() {
  const router = useRouter();

  useEffect(() => {
    // Same origin, same port as the page: `server/index.mts` serves both, so
    // the guest's LAN address works without being told what it is.
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/workspace/ws`);

    socket.addEventListener("message", (event) => {
      let frame: { event?: string };
      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }

      if (frame.event !== "session:revoked") return;

      // `refresh()` first: the cookie is now stale, and without clearing the
      // router cache the join page could render from a payload produced while
      // this device was still signed in.
      router.refresh();
      router.replace("/join");
    });

    // A dropped connection is not an eviction — the server says so explicitly.
    // Reconnection is deliberately absent: nothing else depends on this socket
    // yet, and a takeover the client missed still ends at the join screen on its
    // next request.
    return () => socket.close();
  }, [router]);

  return null;
}
