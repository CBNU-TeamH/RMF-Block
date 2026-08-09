import type { NextConfig } from "next";

// The Turbopack `resolveAlias` that used to live here pointed both `@yorkie-js/*`
// packages at their ESM builds, because they ship one but advertise only the UMD
// build — two copies of every ProseMirror class, and "multiple versions of
// prosemirror-model were loaded" on the first remote change. `patches/` now adds
// the `exports` map the packages are missing, which fixes the bundler and plain
// Node (`server/watcher.mts`) alike, so the alias is gone. Drop the patches once
// upstream declares `exports` itself.
const nextConfig: NextConfig = {
  // Traces the server and its dependencies into `.next/standalone`, so the
  // Docker image the host runs carries a `server.js` and no `node_modules`
  // install step. See `Dockerfile`.
  output: "standalone",
};

export default nextConfig;
