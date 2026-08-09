import { NextResponse, type NextRequest } from "next/server";

import { getHostSecret, isHostSecret } from "@/lib/host-secret";

/**
 * The link `instrumentation.ts` prints to container stdout. Trading the secret
 * for a cookie here — rather than reading it off the URL on every page — is what
 * gets it out of the address bar before the host ever shares their screen
 * (UC-030; `docs/design/api.md`, Authentication model).
 *
 * ponytail: the cookie *is* the secret, so a container restart invalidates every
 * host session for free — the revoke path api.md already specifies. Becomes
 * `POST /api/auth/host` returning a real session token once sessions exist.
 */
export function GET(request: NextRequest) {
  // A relative Location, not `NextResponse.redirect(new URL("/", request.url))`:
  // in the standalone server `request.url` is built from HOSTNAME, so that form
  // sends the host to `http://0.0.0.0:3000/` — a different origin, which drops
  // the cookie we just set. The browser resolves this against the URL it asked for.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/" },
  });

  // A wrong secret is not an error worth a page — that visitor is simply a guest.
  if (isHostSecret(request.nextUrl.searchParams.get("secret") ?? undefined)) {
    response.cookies.set("role", getHostSecret(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}
