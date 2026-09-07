import type { BlockId } from "@/lib/blocks/types";

import type { BlockBox } from "./anchor";

/** Each rendered block's extent in `container`'s coordinate space, the one
 *  `scrollTop` is measured in. **`container` must be a positioned ancestor** —
 *  why: `docs/design/presence-and-focus.md`. An element without a
 *  `data-block-id` is skipped, not turned into a box with a blank id. */
export function readBoxes(container: HTMLElement): Array<BlockBox> {
  const boxes: Array<BlockBox> = [];

  for (const el of container.querySelectorAll<HTMLElement>("[data-block-id]")) {
    const id: BlockId | undefined = el.dataset.blockId;
    if (!id) continue;
    boxes.push({ id, top: el.offsetTop, height: el.offsetHeight });
  }

  return boxes;
}
