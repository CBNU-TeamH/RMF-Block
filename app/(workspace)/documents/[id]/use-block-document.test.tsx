// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Client } from "@yorkie-js/sdk";

import type { BlockDocument } from "@/lib/documents/attach-pool";
import { OCCUPANCY_TICK_MS } from "@/lib/presence/occupancy";
import { useBlockDocument } from "./use-block-document.ts";

afterEach(cleanup);

let counter = 0;
type Published = Record<string, unknown>;

/** A client over a real local `yorkie.Document` that records every presence the
 *  hook publishes. A document no server attached keeps no presence of its own
 *  (`getMyPresence()` stays empty), so the writes are what can be observed. */
function recordingClient(published: Array<Published>): Client {
  return {
    attach: async (doc: BlockDocument) => {
      const update = doc.update.bind(doc);
      doc.update = ((updater, message) =>
        update((root, presence) => {
          const recorded = Object.create(presence) as typeof presence;
          recorded.set = (value, options) => {
            published.push(value as Published);
            return presence.set(value, options);
          };
          return updater(root, recorded);
        }, message)) as BlockDocument["update"];
    },
    detach: async () => undefined,
  } as unknown as Client;
}

function render(published: Array<Published>) {
  const client = recordingClient(published);
  const documentId = `doc-${(counter += 1)}`;
  return renderHook(({ nickname }) => useBlockDocument(client, documentId, "blue", nickname), {
    initialProps: { nickname: "지은" },
  });
}

const cleared = (value: Published) => "activeBlockId" in value && value.activeBlockId === null && "pointer" in value;

describe("useBlockDocument — presence across an effect re-run (#127)", () => {
  it("republishes the focused block at once after a re-run clears it", async () => {
    const published: Array<Published> = [];
    const { result, rerender } = render(published);
    await waitFor(() => assert.ok((result.current.blocks?.length ?? 0) > 0));

    const blockId = result.current.blocks![0]!.id;
    act(() => result.current.setActiveBlockId(blockId));
    const beforeRerun = published.length;

    // A changed nickname re-runs the effect: cleanup clears, the next run re-acquires.
    rerender({ nickname: "민수" });

    // Well inside one heartbeat, so the heartbeat cannot be what restored it.
    await waitFor(
      () => {
        const since = published.slice(beforeRerun);
        const clear = since.findIndex(cleared);
        assert.ok(clear >= 0, "the cleanup cleared this browser's block");
        assert.ok(
          since.slice(clear + 1).some((value) => value.activeBlockId === blockId && value.nickname === "민수"),
          "the re-run republished it",
        );
      },
      { timeout: OCCUPANCY_TICK_MS / 5 },
    );
  });

  it("publishes no block when nothing was focused", async () => {
    const published: Array<Published> = [];
    const { result, rerender } = render(published);
    await waitFor(() => assert.ok((result.current.blocks?.length ?? 0) > 0));
    const beforeRerun = published.length;

    rerender({ nickname: "민수" });
    await waitFor(() => assert.ok(published.slice(beforeRerun).some((value) => value.nickname === "민수")));
    assert.ok(published.slice(beforeRerun).every((value) => !value.activeBlockId));
  });
});
