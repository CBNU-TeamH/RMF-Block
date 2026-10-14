/** Registers this server's auth webhook with Yorkie at startup (NFR-SEC-002/005),
 *  and refuses to run if it cannot. Why the app does this to itself, and why
 *  connect-protocol needs no client library: `docs/design/api.md` §2. */

/** Yorkie's built-in administrator (`server/config.go`). Its password is the one
 *  Compose hands Yorkie; the default is only where an old volume starts from
 *  (`docs/design/api.md` §2). */
const ADMIN_USER = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin";

/**
 * The default project every client uses. Yorkie creates it at first boot with a
 * fixed all-zero id, and nothing here creates a second one.
 */
const DEFAULT_PROJECT_ID = "000000000000000000000000";

/** Which operations Yorkie should ask about (`docs/design/api.md` §2). Names come
 *  from `api/types/auth_webhook.go`; an unknown one fails the update — which is
 *  how the four revision names below were confirmed rather than assumed, since
 *  this vocabulary is not the RPC one (`PushPull` here, `PushPullChanges` on the
 *  wire). Revision reads are open to every live session on purpose:
 *  `docs/design/version-history.md`, "Who may restore". */
const GUARDED_METHODS = [
  "ActivateClient",
  "AttachDocument",
  "DetachDocument",
  "PushPull",
  "WatchDocument",
  "CreateRevision",
  "GetRevision",
  "ListRevisions",
  "RestoreRevision",
];

export class YorkieAdminError extends Error {
  status?: number;
}

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
    const error = new YorkieAdminError(
      `${method} failed (${response.status}): ${await response.text()}`,
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}

/** Yorkie serves its Admin API on the port browsers reach, so in production the
 *  default would hand anyone on the LAN every document (#200). */
function adminPassword(): string {
  const password = process.env.YORKIE_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  if (password === DEFAULT_ADMIN_PASSWORD && process.env.NODE_ENV === "production") {
    throw new YorkieAdminError(
      "YORKIE_ADMIN_PASSWORD is unset or still Yorkie's default — set it in .env (see .env.sample)",
    );
  }
  return password;
}

/** Points the default project at `webhookUrl` — which is reached **by Yorkie**,
 *  so it is written from where Yorkie stands (`docs/design/api.md` §2). */
export async function registerAuthWebhook(
  rpcAddr: string,
  webhookUrl: string,
  { attempts = 30, delayMs = 1000 } = {},
): Promise<void> {
  // Outside the retry: a missing password does not appear in thirty seconds.
  const password = adminPassword();
  // Never loops under compose (`service_healthy` gates it). The retry is for
  // `pnpm dev` against a hand-started Yorkie, where nothing sequences the two.
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await attemptRegister(rpcAddr, webhookUrl, password);
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function tokenFor(rpcAddr: string, password: string): Promise<string> {
  const { token } = (await call(rpcAddr, "LogIn", {
    username: ADMIN_USER,
    password,
  })) as { token?: string };

  if (!token) {
    throw new YorkieAdminError("Yorkie accepted the admin login but returned no token");
  }
  return token;
}

/** Yorkie writes its admin into an empty volume only (`$setOnInsert`), so a
 *  volume from before YORKIE_ADMIN_PASSWORD still answers to the default. That
 *  one is moved onto the configured password here, once. */
async function logIn(rpcAddr: string, password: string): Promise<string> {
  try {
    return await tokenFor(rpcAddr, password);
  } catch (error) {
    if (password === DEFAULT_ADMIN_PASSWORD || !(error instanceof YorkieAdminError) || error.status !== 401) {
      throw error;
    }
    try {
      await tokenFor(rpcAddr, DEFAULT_ADMIN_PASSWORD);
    } catch {
      throw error;
    }
    await call(rpcAddr, "ChangePassword", {
      username: ADMIN_USER,
      currentPassword: DEFAULT_ADMIN_PASSWORD,
      newPassword: password,
    });
    console.log("  Yorkie: replaced the default admin password with YORKIE_ADMIN_PASSWORD");
    return tokenFor(rpcAddr, password);
  }
}

async function attemptRegister(rpcAddr: string, webhookUrl: string, password: string): Promise<void> {
  const token = await logIn(rpcAddr, password);

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
