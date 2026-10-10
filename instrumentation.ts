/** Runs once per server instance, before the first request. Where the host
 *  learns the bootstrap secret and the address guests type (FR-010-03, HIR001).
 *  How this refuses to run: `docs/design/api.md` §2. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getHostSecret } = await import("./lib/host-secret");
  const { isNatRange, lanAddresses } = await import("./lib/lan-address");
  const { getWorkspaceName, isWorkspaceOpen, seedWorkspaceFromEnv } = await import("./lib/workspace-config");
  const { registerAuthWebhook } = await import("./lib/yorkie-admin");

  // Development and CI only: an env password opens a workspace never set up.
  // Caught, not left to throw: Next swallows a rejection here and the process
  // stays up without listening (`docs/design/api.md` §2) — a seed is not worth that.
  try {
    await seedWorkspaceFromEnv();
  } catch (error) {
    console.error(`\n  ✗ Could not seed the workspace from WORKSPACE_PASSWORD: ${error instanceof Error ? error.message : String(error)}\n`);
  }

  // Yorkie only asks about tokens if told to, and that is a project setting —
  // so it must be written after Yorkie is up (`docs/design/api.md` §2).
  const rpcAddr = process.env.YORKIE_ADMIN_ADDR ?? "http://localhost:8080";
  // What Yorkie needs to reach *us* — `localhost` means Yorkie inside its own
  // container. Docker Engine on Linux needs `--add-host=host.docker.internal:host-gateway`.
  const webhookUrl =
    process.env.YORKIE_AUTH_WEBHOOK_URL ??
    `http://host.docker.internal:${process.env.PORT ?? "3000"}/api/internal/yorkie/auth`;

  try {
    await registerAuthWebhook(rpcAddr, webhookUrl);
    // Printed because Yorkie stores this URL without testing it (`docs/design/api.md` §2).
    console.log(`  Auth:  Yorkie will ask ${webhookUrl}`);
  } catch (error) {
    // Fatal in production, and `process.exit` rather than `throw` — Next
    // swallows the throw and the process lives on without listening. Measured;
    // see `docs/design/api.md` §2.
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

  // Not a refusal to start: the host finishes setup in the browser (UC-010),
  // and until then `/join` says the workspace is not open.
  if (!isWorkspaceOpen()) {
    lines.push("         host user의 workspace setting이 완료되지 않았습니다.");
  } else {
    // Said out loud because emptying `.env` does not undo it — the saved
    // settings win, and without this line a host waiting for the setup screen
    // has no clue why it never comes.
    lines.push(`         Workspace "${getWorkspaceName()}" — saved settings in .data/workspace.json`);
  }

  if (!joinAddress) {
    lines.push(
      `         Only ${best ? `a Docker/NAT address (${best})` : "loopback"} is visible from here,`,
      `         which guests on the LAN almost certainly cannot reach.`,
      `         Set HOST_LAN_IP in .env to this machine's LAN IPv4 address -- the`,
      `         comments above it in .env.sample (a release's env.sample) give the`,
      `         command for each OS -- then run \`docker compose up -d\` again. From a`,
      `         clone, \`pnpm docker:up\` detects it.`,
    );
  } else if (!override) {
    lines.push(`         (guessed — set HOST_LAN_IP if guests cannot reach it)`);
  }

  console.log(`${lines.join("\n")}\n`);
}
