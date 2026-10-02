import { useEffect, useRef } from "react";
import { VersionHistory } from "rmf-block";

// The panel lists revisions from Yorkie through the workspace client. Stand in
// for the one call opening it makes, so the card shows a real list.
const t = (d: number, hh: number, mm: number) => new Date(Date.UTC(2026, 8, d, hh - 9, mm));
const revisions = [
  { id: "r4", label: "발표 전 최종본", description: "김민지", createdAt: t(24, 16, 20) },
  { id: "r3", label: "before-restore:r1", description: "최태진", createdAt: t(24, 11, 5) },
  { id: "r2", label: "2주차 회의 반영", description: "박서준", createdAt: t(17, 18, 40) },
  { id: "r1", label: "초안", description: "Host", createdAt: t(10, 9, 0) },
];
const client = { listRevisions: async () => revisions };
const noop = () => undefined;

/** The trigger opened: named versions grouped by day, newest first. */
export function Open() {
  const docRef = useRef({});
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.querySelector("button")?.click(), []);
  return (
    <div ref={ref} className="h-full min-h-[520px] w-full bg-paper p-4">
      <VersionHistory client={client as never} docRef={docRef as never} nickname="최태진" onRestore={noop} />
    </div>
  );
}
