import type { NextConfig } from "next";

// The Turbopack `resolveAlias` that used to live here pointed both `@yorkie-js/*`
// packages at their ESM builds, because they ship one but advertise only the UMD
// build — two copies of every ProseMirror class, and "multiple versions of
// prosemirror-model were loaded" on the first remote change. `patches/` now adds
// the `exports` map the packages are missing, which fixes the bundler and plain
// Node (`server/watcher.mts`) alike, so the alias is gone. Drop the patches once
// upstream declares `exports` itself.
// No `output: "standalone"`: it generates its own `server.js` and cannot
// coexist with `server/index.mts` (needed for WebSocket upgrades — see
// `docs/design/chat.md`). The Dockerfile installs full `node_modules` in the
// runtime stage instead of copying a standalone trace.
const nextConfig: NextConfig = {};

export default nextConfig;
