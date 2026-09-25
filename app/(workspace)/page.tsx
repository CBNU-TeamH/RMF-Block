/**
 * The workspace home. The document tree lives in the layout's sidebar
 * (`docs/ui/redesign/HANDOFF.md`), so with no document open there is only a
 * pointer to it.
 */
export default function WorkspaceHome() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
      <p className="text-[17px] font-semibold text-ink">문서를 선택하세요</p>
      <p className="text-[13px] text-ink-faint">왼쪽 목록에서 문서를 열거나 새 문서를 만들 수 있어요.</p>
    </div>
  );
}
