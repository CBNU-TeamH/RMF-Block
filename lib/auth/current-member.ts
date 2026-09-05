import { cookies } from "next/headers";

import { sessionRegistry } from "./session-registry.ts";
import { SESSION_COOKIE, type WorkspaceMember } from "./types.ts";
import { isHostSecret } from "../host-secret.ts";
import { HOST_PRESENCE } from "../presence/types.ts";

/** Who is calling, or null. Use this to attribute anything to a person — it is
 *  the difference between "the sender says they are alice" and "this is alice".
 *  The host is folded in here so no route has to remember the two-branch check;
 *  why they have no session: `docs/design/presence-and-focus.md`. */
export async function currentMember(): Promise<WorkspaceMember | null> {
  const jar = await cookies();

  const member = sessionRegistry.resolve(jar.get(SESSION_COOKIE)?.value);
  if (member) return member;

  if (isHostSecret(jar.get("role")?.value)) return HOST_PRESENCE;

  return null;
}
