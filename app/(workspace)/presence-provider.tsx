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

/** The workspace's one Yorkie connection, `null` until activated. The editor
 *  attaches its content document through this same client — a second one would
 *  be a second connection, and without `fetchToken` would reopen the hole #50
 *  closed. */
export type PresenceState = {
  status: "connecting" | "active" | "failed";
  members: Array<WorkspacePresence>;
  /** Non-null exactly when `status` is `"active"`; callers check this, not status. */
  client: Client | null;
  /** This browser's own id, exposed on the context so a consumer can pick its
   *  own row out of `members` without a second prop threaded down. */
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

/** What the browser shows Yorkie's auth webhook. The SDK re-calls it on every
 *  refusal, so expiry needs no timer; the `httpOnly` cookie rides along on its
 *  own. Why a failure returns an empty string: the design doc. */
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

/** Owns the browser's single Yorkie connection and hands the roster down
 *  (FR-020-06/07). Why attaching *is* being present, and why this is a provider:
 *  `docs/design/presence-and-focus.md`, "The one connection". */
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
  // A ref, not state: never rendered, only read inside `setPresenting`.
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
    // Stashed for `setPresenting`, which runs outside this closure. Set as soon
    // as `doc` exists — `setPresenting` already no-ops on a `null` ref.
    docRef.current = doc;

    let cancelled = false;
    let unsubscribeOthers: (() => void) | undefined;
    let unsubscribeMine: (() => void) | undefined;

    // Yorkie counts clients; the list shows people (`presence-and-focus.md`).
    const readRoster = () => setMembers(rosterFrom(doc.getPresences()));

    const setup = (async () => {
      await client.activate();
      // #32 — why a mid-flight cleanup needs this guard:
      // `presence-and-focus.md`, "Tearing down mid-flight is what #32 was".
      if (cancelled) return;

      await client.attach(doc, { initialPresence: { id: memberId, nickname, colorTag } });
      if (cancelled) return;

      // Two subscriptions, both before the first read — `others` does not carry
      // this browser's own presence changes. Why:
      // `docs/design/presence-and-focus.md`, "Two subscriptions, not one".
      unsubscribeOthers = doc.subscribe("others", readRoster);
      unsubscribeMine = doc.subscribe("my-presence", readRoster);
      setStatus("active");
      setClient(client);
      readRoster();
    })().catch((error: unknown) => {
      if (cancelled) return;
      setStatus("failed");
      setClient(null);
      // simple: address and reason to the console. A 44px top bar has room for
      // a state, not a stack trace.
      console.error(`Yorkie is not reachable at ${address}`, error);
      // simple: failed is terminal, the only way back a reload. A retry with
      // backoff is #37; nothing else in the app reconnects either.
    });

    return () => {
      cancelled = true;
      // Tear down only once setup has settled (#32, `presence-and-focus.md`).
      void setup.finally(() => {
        unsubscribeOthers?.();
        unsubscribeMine?.();
        // Detaches every document this client holds, including the editor's.
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
