import { AppShell, DocumentList } from "rmf-block";

const minji = { id: "m1", nickname: "김민지", colorTag: "#ef4444" };
const seojun = { id: "m2", nickname: "박서준", colorTag: "#22c55e" };
const host = { id: "h", nickname: "Host", colorTag: "#eab308" };
const row = (id: string, name: string, parentId: string | null, creator: typeof minji | null, created: string, updated: string) => ({
  id, name, parentId, createdBy: creator?.id ?? "gone", creator, createdAt: created, updatedAt: updated,
});

const documents = [
  row("plan", "프로젝트 계획서", null, host, "2026-09-01T01:00:00Z", "2026-09-24T05:12:00Z"),
  row("minutes", "회의록", "plan", minji, "2026-09-03T02:00:00Z", "2026-09-24T04:40:00Z"),
  row("wk1", "1주차 회의", "minutes", minji, "2026-09-03T02:10:00Z", "2026-09-10T08:00:00Z"),
  row("wk2", "2주차 회의", "minutes", seojun, "2026-09-10T02:10:00Z", "2026-09-17T08:00:00Z"),
  row("srs", "요구사항 명세", null, seojun, "2026-09-02T03:00:00Z", "2026-09-20T06:30:00Z"),
  row("old", "아이디어 메모", null, null, "2026-08-28T03:00:00Z", "2026-08-29T06:30:00Z"),
];

/** The workspace's document tree: nesting, creator avatars, a creator the host removed. */
export function Tree() {
  return (
    <AppShell>
      <div className="bg-paper p-6">
        <DocumentList documents={documents} />
      </div>
    </AppShell>
  );
}

export function Empty() {
  return (
    <AppShell>
      <div className="bg-paper p-6">
        <DocumentList documents={[]} />
      </div>
    </AppShell>
  );
}
