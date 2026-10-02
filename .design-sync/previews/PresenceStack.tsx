import { PresenceContext, PresenceStack } from "rmf-block";

const people = [
  { id: "m3", nickname: "최태진", colorTag: "#a855f7" },
  { id: "m1", nickname: "김민지", colorTag: "#ef4444" },
  { id: "m2", nickname: "박서준", colorTag: "#22c55e" },
  { id: "m4", nickname: "이하은", colorTag: "#3b82f6" },
  { id: "m5", nickname: "정도윤", colorTag: "#06b6d4" },
  { id: "host", nickname: "Host", colorTag: "#64748b" },
];
const presence = (status: "connecting" | "active" | "failed", members = people) => ({
  status, members, client: null, memberId: "m3", isPresenting: false, setPresenting: () => undefined,
});

/** The top bar's roster. The viewer is first; past four, the rest fold into +N. */
export function Connected() {
  return (
    <div className="flex flex-col gap-4 bg-paper p-4 pb-8">
      <PresenceContext.Provider value={presence("active", people.slice(0, 3))}>
        <PresenceStack memberId="m3" />
      </PresenceContext.Provider>
      <PresenceContext.Provider value={presence("active")}>
        <PresenceStack memberId="m3" />
      </PresenceContext.Provider>
    </div>
  );
}

export function ConnectionStates() {
  return (
    <div className="flex flex-col gap-3 bg-paper p-4">
      <PresenceContext.Provider value={presence("connecting")}>
        <PresenceStack memberId="m3" />
      </PresenceContext.Provider>
      <PresenceContext.Provider value={presence("failed")}>
        <PresenceStack memberId="m3" />
      </PresenceContext.Provider>
    </div>
  );
}
