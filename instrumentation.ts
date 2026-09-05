/** Runs once per server instance, before the first request. Where the host
 *  learns the bootstrap secret and the address guests type (FR-010-03, HIR001).
 *  How this refuses to run: `docs/design/architecture.md` §3. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getHostSecret } = await import("./lib/host-secret");
  const { isNatRange, lanAddresses } = await import("./lib/lan-address");
  const { assertWorkspaceConfigured } = await import("./lib/workspace-config");
  const { registerAuthWebhook } = await import("./lib/yorkie-admin");

  // Before anything is printed: a workspace with no access password cannot be
  // joined, and the host should find that out here rather than from a guest.
  assertWorkspaceConfigured();

  // Yorkie only asks about tokens if told to, and that is a project setting —
  // so it must be written after Yorkie is up (`docs/design/api.md` §2).
  const rpcAddr = process.env.YORKIE_ADMIN_ADDR ?? "http://localhost:8080";
  // What Yorkie needs to reach *us*, where `localhost` is always wrong — inside
  // Yorkie's container it means Yorkie. The default reaches back out of a
  // containerized Yorkie; compose overrides it with the service name.
  // Docker Engine on Linux needs `--add-host=host.docker.internal:host-gateway`.
  const webhookUrl =
    process.env.YORKIE_AUTH_WEBHOOK_URL ??
    `http://host.docker.internal:${process.env.PORT ?? "3000"}/api/internal/yorkie/auth`;

  try {
    await registerAuthWebhook(rpcAddr, webhookUrl);
    // Printed because Yorkie stores this URL without testing it (architecture.md).
    console.log(`  Auth:  Yorkie will ask ${webhookUrl}`);
  } catch (error) {
    // Fatal in production, and `process.exit` rather than `throw` — Next
    // swallows the throw and the process lives on without listening. Measured;
    // see `docs/design/architecture.md` §3, "Startup".
    if (process.env.NODE_ENV === "production") {
      console.error(
        `\n  ✗ Could not register the Yorkie auth webhook at ${rpcAddr}.\n` +
          `    Refusing to start: Yorkie would accept any client on the network.\n` +
          `    ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exit(1);
    }

    // Not fatal in development, but loud — the one state where the app looks
    // fine and is protecting nothing.
    console.warn(
      `\n  ⚠ Yorkie auth webhook NOT registered (${rpcAddr}).\n` +
        `    Yorkie will accept any client, with or without a session.\n` +
        `    ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }

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
      `         .env for you. By hand: \`ipconfig\` on Windows (the Windows adapter's`,
      `         address, not WSL's — \`ip -4 addr\` inside WSL returns an address guests`,
      `         cannot reach unless mirrored networking is on), \`ip -4 addr\` on Linux,`,
      `         \`ipconfig getifaddr en0\` on macOS. Then restart with HOST_LAN_IP set`,
      `         to it (see docker-compose.yml).`,
    );
  } else if (!override) {
    lines.push(`         (guessed — set HOST_LAN_IP if guests cannot reach it)`);
  }

  console.log(`${lines.join("\n")}\n`);
}
