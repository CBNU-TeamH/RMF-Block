/**
 * Runs once per server instance, before the first request is served. This is
 * where the host learns two things they cannot get anywhere else: the bootstrap
 * secret that proves they are the host, and the address guests type in
 * (FR-010-03, HIR001 — "서버 실행 상태 및 접속 주소를 호스트 화면에 표시").
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getHostSecret } = await import("./lib/host-secret");
  const { isNatRange, lanAddresses } = await import("./lib/lan-address");

  const port = process.env.PORT ?? "3000";
  // `||`, not `??`: compose passes HOST_LAN_IP through as "" when it is unset.
  const override = process.env.HOST_LAN_IP || undefined;
  const [best] = lanAddresses();
  // A Docker/NAT address reaches nobody on the LAN, so it is not printed as the
  // join address — only named, so the host knows why we could not find one.
  const joinAddress = override ?? (best && !isNatRange(best) ? best : null);

  const lines = [
    "",
    `  Host:  http://localhost:${port}/api/auth/host?secret=${getHostSecret()}`,
    `  Guest: http://${joinAddress ?? "<the host machine's LAN IP>"}:${port}`,
  ];

  if (!joinAddress) {
    lines.push(
      `         Only ${best ? `a Docker/NAT address (${best})` : "loopback"} is visible from here,`,
      `         which guests on the LAN almost certainly cannot reach.`,
      `         Start with \`pnpm docker:up\` instead — it detects the address and writes`,
      `         .env for you. By hand: \`ip -4 addr\` on Linux (including WSL) or`,
      `         \`ipconfig getifaddr en0\` on macOS, then restart with HOST_LAN_IP set`,
      `         to it (see docker-compose.yml).`,
    );
  } else if (!override) {
    lines.push(`         (guessed — set HOST_LAN_IP if guests cannot reach it)`);
  }

  console.log(`${lines.join("\n")}\n`);
}
