import { isNatRange, lanAddresses } from "./lan-address.ts";

const YORKIE_PORT = 8080;

/**
 * The Yorkie address a *browser* should connect to.
 *
 * This cannot be a `NEXT_PUBLIC_` variable. Next inlines those when the bundle
 * is built, and the address depends on the machine the host happens to run the
 * image on — so a baked-in value is wrong for everyone but whoever built it.
 * Worse, the obvious default (`localhost:8080`) works in the host's own browser
 * and fails for every guest, which is exactly the bug that would survive local
 * testing. Resolve it per request instead and hand it to the client component.
 *
 * `YORKIE_PUBLIC_ADDR` overrides everything, for setups where Yorkie is not on
 * the same host as the app.
 */
export function yorkiePublicAddress(): string {
  const override = process.env.YORKIE_PUBLIC_ADDR;
  if (override) return override;

  // Same resolution the startup banner uses for the join URL (`instrumentation.ts`):
  // HOST_LAN_IP wins, otherwise the best-guess interface, and a Docker/NAT
  // address is rejected because guests cannot reach it.
  const [best] = lanAddresses();
  const host = best && !isNatRange(best) ? best : "localhost";

  return `http://${host}:${YORKIE_PORT}`;
}
