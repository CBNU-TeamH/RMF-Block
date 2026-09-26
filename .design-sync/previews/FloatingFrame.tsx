import { FloatingFrame } from "rmf-block";

const noop = () => undefined;
const begin = () => noop;

/** The shared chrome for floating windows: the chat window (edge-resizable,
 *  paper-2 title bar) and a floating block view (corner grip, sky-soft bar). */
export function ChatAndFloatingView() {
  return (
    <div className="h-[240px] w-[600px] bg-shell">
      <FloatingFrame
        frame={{ x: 16, y: 16, width: 260, height: 200 }}
        begin={begin}
        resize="edges"
        label="채팅"
        title={<span className="text-[13px] font-semibold text-ink">채팅</span>}
        closeLabel="채팅 닫기"
        onClose={noop}
        className="z-40"
      >
        <p className="p-3 text-[13px] text-ink-soft">대화 내용이 여기에 표시됩니다.</p>
      </FloatingFrame>
      <FloatingFrame
        frame={{ x: 296, y: 16, width: 280, height: 200 }}
        begin={begin}
        resize="corner"
        label="플로팅 뷰: 회의록"
        title={<span className="truncate text-[13px] font-semibold text-ink">회의록</span>}
        closeLabel="플로팅 뷰 닫기"
        closeClassName="text-ink-faint hover:text-danger"
        onClose={noop}
        className="z-[35]"
      >
        <div className="min-h-0 flex-1 overflow-auto p-3 text-[14px] text-ink">
          <p className="font-bold">2주차 회의</p>
          <p className="mt-1 text-ink-soft">발표 자료는 금요일까지 공유 폴더에 올린다.</p>
        </div>
      </FloatingFrame>
    </div>
  );
}
