import type { BlockId } from "@/lib/blocks/types";

import type { InkBox } from "./ink";

/** Each rendered block's extent in `container`'s coordinate space, the one
 *  `scrollTop` is measured in. **`container` must be a positioned ancestor** —
 *  why: `docs/design/presence-and-focus.md`. An element without a
 *  `data-block-id` is skipped, not turned into a box with a blank id.
 *
 *  The horizontal half is read for ink only; every scroll-anchor caller passes
 *  the result straight into `anchorAt`/`scrollTopFor`, which take the narrower
 *  `BlockBox` an `InkBox` already is. */
export function readBoxes(container: HTMLElement): Array<InkBox> {
  const boxes: Array<InkBox> = [];

  for (const el of container.querySelectorAll<HTMLElement>("[data-block-id]")) {
    const id: BlockId | undefined = el.dataset.blockId;
    if (!id) continue;
    boxes.push({
      id,
      top: el.offsetTop,
      height: el.offsetHeight,
      left: el.offsetLeft,
      width: el.offsetWidth,
    });
  }

  return boxes;
}
