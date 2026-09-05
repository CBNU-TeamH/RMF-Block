"use client";

import yorkie, { type Client, type Document } from "@yorkie-js/sdk";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { rosterFrom } from "@/lib/presence/roster";
import { WORKSPACE_DOC_KEY, type WorkspacePresence } from "@/lib/presence/types";

/**
 * `client` is the workspace's one Yorkie connection, `null` until it has
 * activated. The block editor attaches its content document through this
 * same client rather than opening a second one — a second client is a second
 * connection per browser, and one built without `fetchToken` below would
 * quietly reopen the hole PR #50 closed (no `authTokenInjector` at all).
 */
export type PresenceState = {
  status: "connecting" | "active" | "failed";
  members: Array<WorkspacePresence>;
  /** Non-null exactly when `status` is `"active"`; callers check this, not status. */
  client: Client | null;
  /** This browser's own id — a prop on `PresenceProvider` already, exposed
   * here too so a consumer that only has the context (`editor.tsx`'s
   * presenter/follower logic) can pick its own row out of `members` without
   * a second prop threaded down just for that. */
  memberId: string;
  /** Whether THIS browser is presenting — local state, deliberately not read
   *  back out of `members`. Why: `docs/design/presence-and-focus.md`. */
  isPresenting: boolean;
  /** Publishes this browser's `presenting` anchor, or clears it with `null`
   *  (see `WorkspacePresence` for why not `undefined`). A no-op before attach. */
  setPresenting: (presenting: WorkspacePresence["presenting"]) => void;
};

const PresenceContext = createContext<PresenceState>({
  status: "connecting",
  members: [],
  client: null,
  memberId: "",
  isPresenting: false,
  setPresenting: () => undefined,
});

/** Read the workspace roster. Every consumer shares one Yorkie connection. */
export function useWorkspacePresence(): PresenceState {
  return useContext(PresenceContext);
}

/**
 * What the browser shows Yorkie's auth webhook.
 *
 * The SDK re-calls this whenever the webhook refuses, so expiry needs no timer.
 * The session cookie rides along on its own — the fetch is same-origin and the
 * cookie is `httpOnly` so this code never sees it. A failure returns an empty
 * string; why, and what that surfaces as: the design doc.
 */
async function fetchToken(): Promise<string> {
  try {
    const response = await fetch("/api/auth/yorkie-token");
    if (!response.ok) return "";

    const { token } = (await response.json()) as { token?: string };
    return token ?? "";
  } catch {
    return "";
  }
}

/**
 * Owns the browser's single Yorkie connection and hands the roster down
 * (FR-020-06/07).
 *
 * Why attaching *is* being present, why this is a provider, why identity comes
 * in as three strings, and why the address is read off the page's own URL:
 * `docs/design/presence-and-focus.md`, "The one connection, and what it is
 * told".
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
  const [client, setClient] = useState<Client | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  // A ref, not state: the document itself is never rendered, only used from
  // inside `setPresenting` below, so putting it in state would just be an
  // extra render on every attach for nothing render-related.
  const docRef = useRef<Document<Record<string, never>, WorkspacePresence> | null>(null);

  useEffect(() => {
    // Resolved in here, not in render: `window` does not exist while this
    // component renders on the server.
    const address =
      override ?? `${window.location.protocol}//${window.location.hostname}:${port}`;

    const client = new yorkie.Client({ rpcAddr: address, authTokenInjector: fetchToken });
    const doc = new yorkie.Document<Record<string, never>, WorkspacePresence>(
      WORKSPACE_DOC_KEY,
    );
    // Stashed for `setPresenting` below, which runs outside this closure —
    // set as soon as `doc` exists rather than only after attach, since
    // `setPresenting` already no-ops on a `null` ref and does not need a
    // second "is it attached" check to stay safe.
    docRef.current = doc;

    let cancelled = false;
    let unsubscribeOthers: (() => void) | undefined;
    let unsubscribeMine: (() => void) | undefined;

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
      // changing their own presence. It does not cover this browser's own —
      // Yorkie routes a client's own presence changes through a separate
      // `my-presence` channel, so without subscribing to that too, this
      // browser's own `setPresenting` (`FocusShare`'s share/end buttons) would
      // publish correctly for everyone else and never update `members` here,
      // leaving its own header stuck showing the share as never having
      // started. Found by testing the presenter's own button, not by reading
      // the SDK first.
      unsubscribeOthers = doc.subscribe("others", readRoster);
      unsubscribeMine = doc.subscribe("my-presence", readRoster);
      setStatus("active");
      setClient(client);
      readRoster();
    })().catch((error: unknown) => {
      if (cancelled) return;
      setStatus("failed");
      setClient(null);
      // simple: the address and the reason go to the console until someone
      // asks for a real error surface. A 44px top bar has room for a state, not
      // for a stack trace, and this is the one place a guest can be told
      // anything at all about it.
      console.error(`Yorkie is not reachable at ${address}`, error);
      // simple: failed is terminal — the only way back is a reload. A quiet
      // retry with a backoff would fit here and is tracked as issue #37; it is
      // left out for now because nothing else in the app reconnects either, and
      // one component doing it alone would be the odd one out.
    });

    return () => {
      cancelled = true;
      // Tear down only once setup has settled. Doing it mid-flight is what left
      // a client attached with nothing pointing at it (#32) — `deactivate()` is
      // a no-op while the client is still activating, so the chain went on to
      // attach behind the cleanup's back.
      void setup.finally(() => {
        unsubscribeOthers?.();
        unsubscribeMine?.();
        // Detaches every document this client holds, which is what tells the
        // other browsers to drop this member — including any content document
        // the block editor attached through it.
        client.deactivate().catch(() => undefined);
      });
      // Nothing after this effect re-runs should still be able to publish
      // through a document this browser has (or is about to have) detached.
      docRef.current = null;
    };
  }, [memberId, nickname, colorTag, override, port]);

  // Stable across renders — it only ever reads `docRef.current`, so it needs
  // no dependency on `client`/`status`/props the way the effect above does.
  const setPresenting = useCallback((presenting: WorkspacePresence["presenting"]) => {
    const doc = docRef.current;
    if (!doc) return;

    doc.update((_root, presence) => {
      presence.set({ presenting });
    });
    setIsPresenting(presenting != null);
  }, []);

  const value = useMemo<PresenceState>(
    () => ({ status, members, client, memberId, isPresenting, setPresenting }),
    [status, members, client, memberId, isPresenting, setPresenting],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}
