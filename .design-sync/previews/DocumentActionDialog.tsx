import { DocumentActionDialog } from "rmf-block";

const doc = (id: string, name: string, parentId: string | null = null) => ({
  id, name, parentId, createdBy: "host", createdAt: "2026-09-20T00:00:00Z", updatedAt: "2026-09-24T00:00:00Z",
});
const documents = [
  doc("plan", "프로젝트 계획서"),
  doc("minutes", "회의록", "plan"),
  doc("wk1", "1주차 회의", "minutes"),
  doc("wk2", "2주차 회의", "minutes"),
  doc("srs", "요구사항 명세"),
];
const noop = () => undefined;

export function Rename() {
  return <DocumentActionDialog action={{ kind: "rename", document: documents[4] }} documents={documents} onClose={noop} onDone={noop} />;
}

export function Move() {
  return <DocumentActionDialog action={{ kind: "move", document: documents[1] }} documents={documents} onClose={noop} onDone={noop} />;
}

/** Deleting a parent warns how many sub-documents go with it. */
export function DeleteWithChildren() {
  return <DocumentActionDialog action={{ kind: "delete", document: documents[1] }} documents={documents} onClose={noop} onDone={noop} />;
}
