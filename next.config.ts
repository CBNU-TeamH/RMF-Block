import type { NextConfig } from "next";

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
const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
