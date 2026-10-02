import { FileBlockView } from "rmf-block";

const noop = () => undefined;

export function Attachments() {
  return (
    <div className="flex w-96 flex-col gap-1 bg-paper p-4">
      <FileBlockView block={{ id: "f1", type: "file", fileId: "a", fileName: "팀H_중간보고서.hwp", fileType: "application/x-hwp", size: 1_284_096 }} onDelete={noop} />
      <FileBlockView block={{ id: "f2", type: "file", fileId: "b", fileName: "실험데이터_2026-09.xlsx", fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 48_300 }} onDelete={noop} />
    </div>
  );
}

/** An upload with no name falls back to "이름 없는 파일". */
export function Unnamed() {
  return (
    <div className="w-96 bg-paper p-4">
      <FileBlockView block={{ id: "f3", type: "file", fileId: "c", fileName: "", fileType: "application/octet-stream", size: 512 }} onDelete={noop} />
    </div>
  );
}
