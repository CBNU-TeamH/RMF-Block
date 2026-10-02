import { PdfBlockView } from "rmf-block";

const noop = () => undefined;

/** The inline viewer frames the app server's preview endpoint; outside the app
 *  the block shows its not-found state under the header bar. */
export function NotFound() {
  return (
    <div className="w-[28rem] bg-paper p-4">
      <PdfBlockView block={{ id: "p1", type: "pdf", fileId: "slides", fileName: "중간발표_TeamH.pdf", size: 2_483_200 }} onDelete={noop} />
    </div>
  );
}
