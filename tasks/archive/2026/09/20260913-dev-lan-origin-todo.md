# `pnpm dev` turns every LAN guest away at the join form

**Created**: 2026-09-13
**Issue**: none — found while manually verifying PR #96/#97 with three devices
**Design**: no design doc. This is one config field restoring an assumption
[`README.md`](../../../../README.md) and [`instrumentation.ts`](../../../../instrumentation.ts)
already make out loud — that the address they print is an address a guest can
actually use.

The host, on localhost, works. Everyone else — a second browser pointed at the
LAN IP, a phone — gets the join screen, types the nickname and password, and
nothing happens. It reads like a member cap; it isn't. `next dev` serves
`/_next/*` only to origins listed in `allowedDevOrigins`, so a guest on
`http://<lan-ip>:3000` receives the server-rendered HTML and none of the
JavaScript. `join-form.tsx` is a `"use client"` component whose `<form>` has no
`action`: unhydrated, its `onSubmit` never runs and the browser falls back to a
native GET, which is why the server log shows

```
GET /join?nickname=jin&password=test1234 200
```

— the password in the query string, and no session created.

Dev-only. `next start`, which is what the container runs, has no such
restriction, so `pnpm docker:up` was never affected and CI could not have caught
this.

## Milestones

### 1. Serve dev assets to the addresses we tell guests to type

- **What**: `allowedDevOrigins` carries the host's own LAN addresses, so the
  address `instrumentation.ts` prints as `Guest:` is an address dev serves.
- **Files**: `next.config.ts`, `next.config.test.mts` (new).
- **Reuse**: `lanAddresses()` (`lib/lan-address.ts`) — the same function
  `instrumentation.ts` already picks the printed join address from, including
  its `HOST_LAN_IP` override. No second notion of "our address".
- **Done**: a phone on the LAN joins with a nickname and password.
- **Also**: `devOrigins()` rather than `lanAddresses()` directly. The latter
  collapses to `[HOST_LAN_IP]` when that is set — correct for "which address do
  we advertise", wrong here: a host who sets it was then locked out of their own
  `127.0.0.1`. Reproduced before fixing.

## Acceptance

- [x] `allowedDevOrigins` follows `HOST_LAN_IP` when set (unit test, and it
      fails with the field removed — checked, not assumed)
- [x] No `Blocked cross-origin request to Next.js dev resource` in the dev log
      after a LAN client loads `/join`
- [x] A LAN client is served `/_next/static/chunks/*` (200, not blocked)
- [x] A third device joins with a nickname and password and lands in the
      workspace — the symptom that started this. Confirmed on a phone, Safari
      and a second Chrome profile at once, alongside the host.
- [x] `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm comments`, `pnpm verify:docs`

## Cross-cutting

FR-010-03 / HIR001 — the join address the host is handed has to be one a guest
can use. Nothing in the container path changes; `AGENTS.md` §2 asks for
container verification of networking changes, and this field does not exist in
that path, so the check that matters here is the dev one above.

Left for a separate issue, deliberately: the form's unhydrated fallback puts the
workspace password in a URL. Allowing the origin stops it happening here, but
the degradation is still reachable any time the JavaScript fails to load.

## Review

Shipped the one field, the `devOrigins()` split behind it, and regression tests
for both. The password-in-URL degradation it exposed is filed separately rather
than folded in — a different fix, in a different file, on a different risk.

One thing this task nearly shipped wrong: a second cause was reported, then
withdrawn. See the lessons doc — the short version is that two of the signals
used to argue for it were not evidence of anything.
