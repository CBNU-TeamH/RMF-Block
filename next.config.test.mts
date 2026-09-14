import assert from "node:assert/strict";
import { test } from "vitest";

// The regression this guards is invisible where everyone develops: on
// localhost the app works whether or not `allowedDevOrigins` is set, and it is
// only a guest on the LAN — the product's entire audience — who is served HTML
// with no JavaScript behind it. Imported dynamically, and only here, because
// the config reads the origin list once at module load: a static import would
// resolve before the override below is set.
test("dev serves /_next/* to the LAN address a guest is told to type", async () => {
  process.env.HOST_LAN_IP = "192.168.0.14";
  try {
    const { default: nextConfig } = await import("./next.config.ts");
    assert.ok(nextConfig.allowedDevOrigins?.includes("192.168.0.14"));
    // The override must not narrow the list to itself — a host who sets it
    // would otherwise be locked out of their own machine.
    assert.ok(nextConfig.allowedDevOrigins?.includes("127.0.0.1"));
  } finally {
    delete process.env.HOST_LAN_IP;
  }
});
