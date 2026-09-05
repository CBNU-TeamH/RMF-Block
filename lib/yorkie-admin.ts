/** Registers this server's auth webhook with Yorkie at startup (NFR-SEC-002/005),
 *  and refuses to run if it cannot. Why the app does this to itself, and why
 *  connect-protocol needs no client library: `docs/design/api.md` §2. */

/** Yorkie's built-in administrator (`server/config.go`). */
const ADMIN_USER = "admin";
const ADMIN_PASSWORD = "admin";

/**
 * The default project every client uses. Yorkie creates it at first boot with a
 * fixed all-zero id, and nothing here creates a second one.
 */
const DEFAULT_PROJECT_ID = "000000000000000000000000";

/** Which operations Yorkie should ask about (`docs/design/api.md` §2). Names come
 *  from `api/types/auth_webhook.go`; an unknown one fails the update. */
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

/** Points the default project at `webhookUrl` — which is reached **by Yorkie**,
 *  so it is written from where Yorkie stands (`docs/design/api.md` §2). */
export async function registerAuthWebhook(
  rpcAddr: string,
  webhookUrl: string,
  { attempts = 30, delayMs = 1000 } = {},
): Promise<void> {
  // Never loops under compose (`service_healthy` gates it). The retry is for
  // `pnpm dev` against a hand-started Yorkie, where nothing sequences the two.
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
