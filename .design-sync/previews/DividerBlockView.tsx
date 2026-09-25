import { DividerBlockView } from "rmf-block";

const noop = () => undefined;

/** Sits inside the editor's per-block `group` row; 삭제 appears on hover. */
export function BetweenParagraphs() {
  return (
    <div className="flex w-96 flex-col bg-paper p-4 text-[15px] text-ink">
      <p>1주차 회의에서 역할 분담을 확정했다.</p>
      <div className="group">
        <DividerBlockView block={{ id: "d1", type: "divider" }} onDelete={noop} />
      </div>
      <p>다음 회의는 수요일 오후 3시.</p>
    </div>
  );
}
