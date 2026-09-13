import type { NextConfig } from "next";

import { devOrigins } from "./lib/lan-address";

// `@yorkie-js/sdk` ships an ESM build but advertises only the UMD one, so a
// bundler and plain Node can end up loading two different copies of it.
// `patches/` adds the `exports` map the package is missing, which fixes both at
// once — the Turbopack `resolveAlias` that used to do the same job from here is
// gone. Drop the patch once upstream declares `exports` itself.
// No `output: "standalone"`: it generates its own `server.js` and cannot
// coexist with `server/index.mts` (needed for WebSocket upgrades — see
// `docs/design/chat.md`). The Dockerfile installs full `node_modules` in the
// runtime stage instead of copying a standalone trace.
// Separate dev/build output dirs — see docs/conventions.md, "Why next.config.ts
// picks a different distDir for pnpm dev". Fixes a known regression: a local
// `pnpm build` used to leave a production `.next` that `pnpm dev` couldn't use.
// A guest reaches this app by the host's LAN address, never localhost — that
// is the whole product. `next dev` serves `/_next/*` only to origins it was
// told about, so without this a guest gets the server-rendered HTML and no
// JavaScript: `join-form.tsx` never hydrates, its `onSubmit` never runs, and
// the browser falls back to a native GET that puts the password in the URL and
// logs nobody in. `lanAddresses()` is the same list `instrumentation.ts` prints
// the join address from, so the address a guest is told to type is the address
// dev serves. Dev-only — `next start`, which is what the container runs, has no
// such restriction.
const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  allowedDevOrigins: devOrigins(),
};

export default nextConfig;
