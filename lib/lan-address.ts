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

  const external = Object.values(networkInterfaces())
    .flatMap((ifaces) => ifaces ?? [])
    .filter((iface) => iface.family === "IPv4" && !iface.internal)
    .map((iface) => iface.address);

  // 172.16/12 is where Docker puts its bridge networks and where WSL2 puts its
  // NAT — an address there usually reaches nobody on the LAN. Rank those last
  // rather than dropping them: a campus LAN can legitimately live in 172.16/12
  // too, and then it is the only answer we have.
  return [
    ...external.filter((address) => !isNatRange(address)),
    ...external.filter(isNatRange),
  ];
}

export function isNatRange(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  return a === 172 && b >= 16 && b <= 31;
}
