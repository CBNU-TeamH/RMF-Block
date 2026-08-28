/**
 * Registers this server's auth webhook with Yorkie (NFR-SEC-002/005).
 *
 * The webhook URL is a **project** field, not a server flag — `cmd/yorkie/server.go`
 * exposes only the cache size and TTL — so something has to call Yorkie's Admin
 * API after it is up. Leaving that to the host would make `docker compose up`
 * two steps and, worse, make an unguarded Yorkie the state you get by
 * forgetting the second. So the app does it to itself at startup, and refuses
 * to run if it cannot.
 *
 * The Admin API is connect-protocol, which speaks HTTP/JSON, so this needs no
 * client library — the JS SDK ships none. Two calls: log in for a token, then
 * update the project.
 */

/** Yorkie's built-in administrator (`server/config.go`). */
const ADMIN_USER = "admin";
const ADMIN_PASSWORD = "admin";

/**
 * The default project every client uses. Yorkie creates it at first boot with a
 * fixed all-zero id, and nothing here creates a second one.
 */
const DEFAULT_PROJECT_ID = "000000000000000000000000";

/**
 * Which operations Yorkie should ask about. `ActivateClient` is the one that
 * matters most: refusing it stops a client before it reaches any document at
 * all, so the rest are defence in depth against a client that somehow got past
 * it. Names come from `api/types/auth_webhook.go` — it is `WatchDocument`
 * singular, and an unknown name fails the update rather than being ignored.
 */
const GUARDED_METHODS = [
  "ActivateClient",
  "AttachDocument",
  "DetachDocument",
  "PushPull",
  "WatchDocument",
];

export class YorkieAdminError extends Error {}

async function call(rpcAddr: string, method: string, body: unknown, token?: string) {
  const response = await fetch(`${rpcAddr}/yorkie.v1.AdminService/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // The scheme is not optional: without `Bearer ` Yorkie answers "invalid
      // authorization header format", which reads like a bad token rather than
      // a missing prefix.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new YorkieAdminError(
      `${method} failed (${response.status}): ${await response.text()}`,
    );
  }

  return response.json();
}

/**
 * Points the default project at `webhookUrl` and names the methods to guard.
 *
 * `webhookUrl` is reached **by Yorkie**, not by a browser, so it has to be
 * written from where Yorkie stands: inside compose that is the app's service
 * name, not `localhost`, which would be Yorkie's own container.
 */
export async function registerAuthWebhook(
  rpcAddr: string,
  webhookUrl: string,
  { attempts = 30, delayMs = 1000 } = {},
): Promise<void> {
  // Yorkie carries no healthcheck — its image has no curl, wget or nc, and its
  // shell has no /dev/tcp, so nothing inside the container can probe port 8080
  // (`docker-compose.yml` says so at length). `depends_on` therefore orders the
  // containers and promises nothing about readiness, and the first attempt here
  // often lands while Yorkie is still coming up. Retrying is the whole fix, and
  // it works outside compose too, where there is no `depends_on` at all.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await attemptRegister(rpcAddr, webhookUrl);
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function attemptRegister(rpcAddr: string, webhookUrl: string): Promise<void> {
  const { token } = (await call(rpcAddr, "LogIn", {
    username: ADMIN_USER,
    password: ADMIN_PASSWORD,
  })) as { token?: string };

  if (!token) {
    throw new YorkieAdminError("Yorkie accepted the admin login but returned no token");
  }

  await call(
    rpcAddr,
    "UpdateProject",
    {
      id: DEFAULT_PROJECT_ID,
      fields: {
        authWebhookUrl: webhookUrl,
        authWebhookMethods: { methods: GUARDED_METHODS },
      },
    },
    token,
  );
}
