import { useEffect, useRef, type ReactNode } from "react";
import { DocumentRowMenu } from "rmf-block";

const noop = () => undefined;
const items = [
  { label: "하위 문서 추가", onSelect: noop },
  { label: "이름 변경", onSelect: noop },
  { label: "이동", onSelect: noop },
  { label: "삭제", onSelect: noop, danger: true },
];

/** Opens its ⋯ trigger once on mount, so the card shows the menu. */
function Opened({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.querySelector("button")?.click(), []);
  return <div ref={ref}>{children}</div>;
}

/** The ⋯ at the end of a document-list row; the destructive item sits below a rule. */
export function OpenOnRow() {
  return (
    <div className="min-h-[280px] w-full bg-paper p-4">
      <div className="group/row flex w-80 items-center rounded-md border border-ink px-3.5 py-2.5">
        <span className="flex-1 truncate text-[13.5px] font-semibold text-ink">회의록</span>
        <Opened>
          <DocumentRowMenu label="회의록" items={items} />
        </Opened>
      </div>
    </div>
  );
}
