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
  const { assertWorkspaceConfigured } = await import("./lib/workspace-config");
  const { registerAuthWebhook } = await import("./lib/yorkie-admin");

  // Before anything is printed: a workspace with no access password cannot be
  // joined, and the host should find that out here rather than from a guest.
  assertWorkspaceConfigured();

  // Yorkie only asks about a client's token if this server has told it to, and
  // that setting lives on the project rather than on Yorkie's command line — so
  // it has to be written after Yorkie is up, which means from here.
  const rpcAddr = process.env.YORKIE_ADMIN_ADDR ?? "http://localhost:8080";
  // The default is what Yorkie needs to reach *us*, and `localhost` is the one
  // answer that is always wrong: inside Yorkie's container it means Yorkie.
  // Development runs the app natively against a containerized Yorkie, so the
  // default is the address that reaches back out of it. Compose overrides this
  // with the service name, and a native Yorkie would want plain localhost.
  //
  // Docker Desktop resolves `host.docker.internal` on its own; plain Docker
  // Engine on Linux needs `--add-host=host.docker.internal:host-gateway`.
  const webhookUrl =
    process.env.YORKIE_AUTH_WEBHOOK_URL ??
    `http://host.docker.internal:${process.env.PORT ?? "3000"}/api/internal/yorkie/auth`;

  try {
    await registerAuthWebhook(rpcAddr, webhookUrl);
    // Printed because success here is otherwise invisible, and because Yorkie
    // stores this URL without ever testing it. An address Yorkie cannot reach
    // registers exactly like one it can, and only shows up later as clients
    // failing with `verify access: send webhook` — which reads like a Yorkie
    // fault rather than a wrong address. Seeing it at startup is the difference.
    console.log(`  Auth:  Yorkie will ask ${webhookUrl}`);
  } catch (error) {
    // In production this is fatal. An unguarded Yorkie is reachable by anything
    // on the LAN, and a workspace that runs anyway would be one nobody knows is
    // open — the failure has to be the loud kind.
    //
    // `process.exit` rather than `throw`, which was the first attempt and does
    // not work: Next installs its own `unhandledRejection` listener, so a throw
    // from here is logged and swallowed, `app.prepare()` never rejects, and the
    // process lives on without ever listening. Measured — it sat there for
    // forty-five seconds. In a container that is the worst outcome available:
    // Docker sees a running service, `restart` never fires, and compose reports
    // no failure, so the workspace looks up while serving nothing.
    if (process.env.NODE_ENV === "production") {
      console.error(
        `\n  ✗ Could not register the Yorkie auth webhook at ${rpcAddr}.\n` +
          `    Refusing to start: Yorkie would accept any client on the network.\n` +
          `    ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exit(1);
    }

    // In development it is not, because Yorkie is often simply not running and
    // most work does not need it. It still has to be impossible to miss: this
    // is the one state where the app looks fine and is not protecting anything.
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
