import { randomUUID, timingSafeEqual } from "node:crypto";

// The host is whoever can read container stdout: the server mints this secret at
// startup, `instrumentation.ts` prints it, and `/api/auth/host` trades it for a
// cookie (`docs/design/api.md`, Authentication model). A restart mints a new one,
// which is what makes "restart the container" the revoke path.
//
// ponytail: one process = one secret, cached on globalThis so dev HMR module
// reloads don't mint a second one. If the server ever splits across workers, set
// HOST_SECRET in the environment and every worker agrees instead.
const cache = globalThis as { __hostSecret?: string };

const hostSecret = (cache.__hostSecret ??=
  process.env.HOST_SECRET ?? randomUUID());

/** The secret itself. Only `instrumentation.ts` should print it. */
export function getHostSecret(): string {
  return hostSecret;
}

export function isHostSecret(candidate: string | undefined): boolean {
  if (!candidate) return false;
  const given = Buffer.from(candidate);
  const expected = Buffer.from(hostSecret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
