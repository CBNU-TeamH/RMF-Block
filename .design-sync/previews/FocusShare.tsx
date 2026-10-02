import { AppShell, FocusShare, PresenceContext } from "rmf-block";

const minji = { id: "m1", nickname: "김민지", colorTag: "#ef4444" };
const me = { id: "m3", nickname: "최태진", colorTag: "#a855f7" };
const presence = (members: Array<typeof me & { presenting?: object | null }>, isPresenting = false) => ({
  status: "active" as const, members, client: null, memberId: me.id, isPresenting, setPresenting: () => undefined,
});

/** The view-sharing button on a document page, in its three states. */
export function States() {
  return (
    <AppShell pathname="/documents/minutes">
      <div className="flex flex-col items-start gap-3 bg-paper p-4">
        <PresenceContext.Provider value={presence([me])}>
          <FocusShare memberId={me.id} />
        </PresenceContext.Provider>
        <PresenceContext.Provider value={presence([me, { ...minji, presenting: { documentId: "minutes", blockId: "b1", ratio: 0 } }])}>
          <FocusShare memberId={me.id} />
        </PresenceContext.Provider>
        <PresenceContext.Provider value={presence([me], true)}>
          <FocusShare memberId={me.id} />
        </PresenceContext.Provider>
      </div>
    </AppShell>
  );
}
