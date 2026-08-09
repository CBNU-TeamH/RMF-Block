import assert from "node:assert/strict";
import { test } from "node:test";

import { isNatRange, lanAddresses } from "./lan-address.ts";

test("HOST_LAN_IP is the single answer when set", () => {
  process.env.HOST_LAN_IP = "192.168.0.14";
  try {
    assert.deepEqual(lanAddresses(), ["192.168.0.14"]);
  } finally {
    delete process.env.HOST_LAN_IP;
  }
});

test("an empty HOST_LAN_IP is not an override — compose passes one when unset", () => {
  process.env.HOST_LAN_IP = "";
  try {
    assert.notDeepEqual(lanAddresses(), [""]);
  } finally {
    delete process.env.HOST_LAN_IP;
  }
});

test("only 172.16.0.0/12 counts as the Docker/WSL NAT range", () => {
  for (const address of ["172.16.0.1", "172.17.0.2", "172.31.255.254"]) {
    assert.ok(isNatRange(address), address);
  }
  for (const address of ["172.15.0.1", "172.32.0.1", "192.168.0.14", "10.0.0.5"]) {
    assert.ok(!isNatRange(address), address);
  }
});
