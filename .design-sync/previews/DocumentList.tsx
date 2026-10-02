import { AppShell, DocumentList } from "rmf-block";

const row = (id: string, name: string, parentId: string | null = null) => ({
  id, name, parentId, createdBy: "m1", createdAt: "2026-09-01T01:00:00Z", updatedAt: "2026-09-24T05:12:00Z",
});

const documents = [
  row("plan", "프로젝트 계획서"),
  row("minutes", "회의록", "plan"),
  row("wk1", "1주차 회의", "minutes"),
  row("wk2", "2주차 회의", "minutes"),
  row("srs", "요구사항 명세"),
  row("ideas", "아이디어 메모"),
];

/** The sidebar as the workspace layout frames it: 260px, paper-2, with the open
 *  document (from `AppShell`'s pathname) highlighted. */
function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <aside className="flex h-[420px] w-[260px] flex-col border-r border-line bg-paper-2 px-1.5 pt-2">
      <div className="mb-1 flex h-9 items-center gap-2 px-2">
        <span className="flex size-5 items-center justify-center rounded-[5px] bg-ink text-[11px] font-bold text-paper">r</span>
        <span className="font-semibold text-ink">TeamH 워크스페이스</span>
      </div>
      {children}
    </aside>
  );
}

export function Tree() {
  return (
    <AppShell pathname="/documents/wk1">
      <Sidebar>
        <DocumentList documents={documents} />
      </Sidebar>
    </AppShell>
  );
}

export function Empty() {
  return (
    <AppShell>
      <Sidebar>
        <DocumentList documents={[]} />
      </Sidebar>
    </AppShell>
  );
}
