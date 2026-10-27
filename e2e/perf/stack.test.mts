import net from "node:net";
import { describe, it } from "vitest";

import { free } from "./stack.ts";

describe("free — the port check before a round's stack", () => {
  it("waits for a port the previous round is still releasing", async () => {
    const holder = net.createServer();
    await new Promise<void>((resolve) => holder.listen(0, "127.0.0.1", resolve));
    const { port } = holder.address() as net.AddressInfo;
    setTimeout(() => holder.close(), 500);
    await free("127.0.0.1", port);
  });
});
