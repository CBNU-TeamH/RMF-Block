import { networkInterfaces } from "node:os";

/**
 * IPv4 addresses a guest could type into their browser (FR-010-03, HIR001),
 * best guess first. Empty only when no external interface exists at all.
 *
 * `HOST_LAN_IP` wins outright — it is the escape hatch for every case the guess
 * gets wrong.
 */
export function lanAddresses(): string[] {
  const override = process.env.HOST_LAN_IP;
  if (override) return [override];

  const external = externalIPv4();

  // 172.16/12 is where Docker puts its bridge networks and where WSL2 puts its
  // NAT — an address there usually reaches nobody on the LAN. Rank those last
  // rather than dropping them: a campus LAN can legitimately live in 172.16/12
  // too, and then it is the only answer we have.
  return [
    ...external.filter((address) => !isNatRange(address)),
    ...external.filter(isNatRange),
  ];
}

/** Origins `next dev` may serve `/_next/*` to. Distinct from
 *  `lanAddresses()` on purpose: that one answers "which address do we
 *  advertise to a guest", where narrowing to the override is the whole point,
 *  and this one answers "which origins may load the app at all", where
 *  narrowing locks somebody out — a host who sets `HOST_LAN_IP` would
 *  otherwise be shut out of their own `127.0.0.1`. So the override *adds*
 *  here, and loopback is always in.
 *
 *  Dev-only. `next start`, which is what the container runs, has no such
 *  restriction and never reads this. */
export function devOrigins(): string[] {
  const override = process.env.HOST_LAN_IP;

  return [
    ...new Set([
      "localhost",
      "127.0.0.1",
      ...externalIPv4(),
      ...(override ? [override] : []),
    ]),
  ];
}

function externalIPv4(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((ifaces) => ifaces ?? [])
    .filter((iface) => iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface.address);
}

export function isNatRange(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  return a === 172 && b >= 16 && b <= 31;
}
