import type { BlockId } from "@/lib/blocks/types";

import type { BlockBox } from "./anchor";

/**
 * Reads each rendered block's extent straight off the DOM, in `container`'s
 * own coordinate space — the same space `container.scrollTop` is measured
 * in, so the two can feed `anchorAt`/`scrollTopFor` together.
 *
 * `container` has to be a positioned ancestor of the block elements (the
 * scroll container in `editor.tsx` carries `relative` for exactly this):
 * without it, `offsetTop` would resolve against whichever further-out
 * ancestor becomes each block's `offsetParent` instead, which does not line
 * up with `container.scrollTop` at all.
 *
 * Plain iteration, not `.map` straight off the `NodeList` — an element
 * missing `data-block-id` (there is no such element today, but nothing here
 * assumes there never will be) is skipped rather than turned into a box with
 * a blank id.
 */
export function readBoxes(container: HTMLElement): Array<BlockBox> {
  const boxes: Array<BlockBox> = [];

  for (const el of container.querySelectorAll<HTMLElement>("[data-block-id]")) {
    const id: BlockId | undefined = el.dataset.blockId;
    if (!id) continue;
    boxes.push({ id, top: el.offsetTop, height: el.offsetHeight });
  }

  return boxes;
}
