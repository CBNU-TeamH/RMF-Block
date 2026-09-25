import { DocLinkBlockView } from "rmf-block";

// The block resolves the linked document's current name from the app server;
// answer that one route so the card shows its resolved state.
const names: Record<string, string> = { minutes: "회의록", srs: "요구사항 명세" };
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const m = /\/api\/documents\/([^/?]+)$/.exec(String(input));
  if (m && names[m[1]]) {
    return Promise.resolve(new Response(JSON.stringify({ document: { id: m[1], name: names[m[1]] } })));
  }
  return realFetch(input, init);
};
const noop = () => undefined;

export function Linked() {
  return (
    <div className="flex w-96 flex-col gap-1 bg-paper p-4">
      <DocLinkBlockView block={{ id: "l1", type: "doc-link", documentId: "minutes" }} onDelete={noop} />
      <DocLinkBlockView block={{ id: "l2", type: "doc-link", documentId: "srs" }} onDelete={noop} />
    </div>
  );
}

/** The linked document was deleted since the link was made. */
export function DeletedTarget() {
  return (
    <div className="w-96 bg-paper p-4">
      <DocLinkBlockView block={{ id: "l3", type: "doc-link", documentId: "gone" }} onDelete={noop} />
    </div>
  );
}
