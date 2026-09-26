import { ImageBlockView } from "rmf-block";

const noop = () => undefined;

/** Images load from the app server's file store; outside the app the block
 *  shows its not-found state with the caption row intact. */
export function NotFound() {
  return (
    <div className="w-96 bg-paper p-4">
      <ImageBlockView block={{ id: "i1", type: "image", fileId: "whiteboard", fileName: "화이트보드_스케치.png", size: 734_003 }} onDelete={noop} />
    </div>
  );
}
