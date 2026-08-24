import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { yorkieClientConfig } from "./yorkie-address.ts";

const originalOverride = process.env.YORKIE_PUBLIC_ADDR;
const originalPort = process.env.YORKIE_PORT;

afterEach(() => {
  process.env.YORKIE_PUBLIC_ADDR = originalOverride;
  process.env.YORKIE_PORT = originalPort;
});

describe("yorkieClientConfig", () => {
  it("carries no host — the client pairs the port with its own", () => {
    // The whole point of the fix: handing back a host is what sent a page loaded
    // at localhost to fetch the LAN address, which desktop browsers refuse.
    delete process.env.YORKIE_PUBLIC_ADDR;
    delete process.env.YORKIE_PORT;

    assert.deepEqual(yorkieClientConfig(), { override: null, port: 8080 });
  });

  it("passes an override through", () => {
    process.env.YORKIE_PUBLIC_ADDR = "http://yorkie.example:9090";

    assert.equal(yorkieClientConfig().override, "http://yorkie.example:9090");
  });

  it("treats a blank override as absent", () => {
    // compose passes an unset variable through as "".
    process.env.YORKIE_PUBLIC_ADDR = "";

    assert.equal(yorkieClientConfig().override, null);
  });

  it("accepts a custom port", () => {
    process.env.YORKIE_PORT = "9090";

    assert.equal(yorkieClientConfig().port, 9090);
  });

  it("falls back when the port is not a usable number", () => {
    process.env.YORKIE_PORT = "not-a-port";
    assert.equal(yorkieClientConfig().port, 8080);

    process.env.YORKIE_PORT = "0";
    assert.equal(yorkieClientConfig().port, 8080);
  });
});
