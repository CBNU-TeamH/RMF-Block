import { cookies } from "next/headers";

import { sessionRegistry } from "./session-registry.ts";
import { SESSION_COOKIE, type WorkspaceMember } from "./types.ts";
import { isHostSecret } from "../host-secret.ts";
import { HOST_PRESENCE } from "../presence/types.ts";

/**
 * Who is calling, as far as the server is concerned — or null for anyone the
 * workspace has not admitted.
 *
 * Route handlers that attribute something to a person need this rather than
 * whatever the request body claims. It is the whole difference between "the
 * sender says they are alice" and "this is alice".
 *
 * The host is folded in here rather than left to each caller. They hold no
 * guest session — identity comes from having started the container, not from
 * the join form — so every route that asks "who is this" would otherwise have
 * to remember the same two-branch check, and forgetting it locks the host out
 * of their own workspace. `HOST_PRESENCE` is the same synthetic member the
 * roster already shows them as, so a message from the host reads consistently
 * wherever it appears.
 */
export async function currentMember(): Promise<WorkspaceMember | null> {
  const jar = await cookies();

  const member = sessionRegistry.resolve(jar.get(SESSION_COOKIE)?.value);
  if (member) return member;

  if (isHostSecret(jar.get("role")?.value)) return HOST_PRESENCE;

  return null;
}
