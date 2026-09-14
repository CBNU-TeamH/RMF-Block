# `pnpm dev` turns every LAN guest away at the join form — lessons

**Created**: 2026-09-13

## What surprised us

- The symptom named a cap that does not exist. Three people could not sign in,
  so the first suspect was `MAX_MEMBERS` — which is 64. The real boundary was
  not how many clients but *which origin*: localhost worked, the LAN address
  never did, and with one host plus one localhost browser that reads as
  "the third one fails".
- A `"use client"` form that never hydrates does not fail loudly. It degrades to
  a native GET, answers 200, and re-renders the same page — indistinguishable
  from a wrong password unless you read the URL.
- The one line that actually named the cause was a dev-server warning
  (`Blocked cross-origin request to Next.js dev resource`), printed once, on a
  different request from the one that looked broken.

- `self.__next_f` is **empty on a correctly hydrated page** — Next consumes the
  flight array during hydration. Measured on a page with 91 live React fibers.
  It was read here as "the inline RSC scripts never ran", and that reading was
  used to claim a second, unfound cause. It proved nothing.
- Restarting `pnpm dev` while a tab is open reproduces the exact same symptom as
  the real bug: every `/_next/*` request 200 (from disk cache, against the
  previous build), no console error, no hydration. Three restarts during this
  task produced three "intermittent failures" that were only ever that.

## What we would do differently

- Read the server log before the application code. The cause was in it from the
  first attempt; an hour of the registry, the webhook and Yorkie's client limits
  came first.
- Hard-reload, or use a fresh profile, before calling anything a second bug —
  and never debug a dev-server issue in a browser that has an extension
  injecting into the page (a translator was rewriting `<html>`'s class here and
  cost a detour of its own).
- Check a signal against a known-good page *before* reasoning from it. One
  measurement on the working workspace route would have retired the
  `self.__next_f` theory immediately.

## Worth extracting

- `AGENTS.md` §2 already says networking changes are verified against the
  container, not `pnpm dev`. This is the mirror image and worth saying too:
  **`pnpm dev` has its own LAN behaviour, and it is not the container's.** A
  dev-only defect cannot be caught by CI or by the smoke test, so a LAN-first
  product needs at least one manual pass from a device that is not the host.
- A helper that answers "which address do we advertise" is not the same as one
  answering "which origins may load this at all". `lanAddresses()` narrows to
  the override by design; reusing it for the second question locked the host out
  of `127.0.0.1`. Split them (`devOrigins()`) rather than widening the original.
- `instrumentation.ts` prints a `Guest:` address; until this change, dev could
  print an address it would then refuse to serve. Anything that *advertises* an
  address should be wired to the same source as whatever *serves* it — here,
  `lanAddresses()` for both.
