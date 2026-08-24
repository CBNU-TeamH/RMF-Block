import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { yorkiePublicAddress } from "./yorkie-address.ts";

const originalLanIp = process.env.HOST_LAN_IP;
const originalOverride = process.env.YORKIE_PUBLIC_ADDR;

afterEach(() => {
  process.env.HOST_LAN_IP = originalLanIp;
  process.env.YORKIE_PUBLIC_ADDR = originalOverride;
});

describe("yorkiePublicAddress", () => {
  it("uses the host's LAN address, not localhost", () => {
    // The whole point: a guest's browser has to reach the host machine.
    delete process.env.YORKIE_PUBLIC_ADDR;
    process.env.HOST_LAN_IP = "192.168.0.14";

    assert.equal(yorkiePublicAddress(), "http://192.168.0.14:8080");
  });

  it("lets YORKIE_PUBLIC_ADDR win outright", () => {
    process.env.HOST_LAN_IP = "192.168.0.14";
    process.env.YORKIE_PUBLIC_ADDR = "http://yorkie.example:9090";

    assert.equal(yorkiePublicAddress(), "http://yorkie.example:9090");
  });

  it("falls back to localhost rather than a NAT address", () => {
    // 172.16/12 is where Docker and WSL2 put their bridges — reachable by
    // nobody on the LAN, so localhost is the less misleading answer.
    delete process.env.YORKIE_PUBLIC_ADDR;
    process.env.HOST_LAN_IP = "172.22.0.1";

    assert.equal(yorkiePublicAddress(), "http://localhost:8080");
  });
});
