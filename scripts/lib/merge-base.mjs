// Shared by the scripts that diff against main (comment-budget.mjs,
// verify-srs-sync.mjs) — extracted when the second one needed the same base.

import { execFileSync } from "node:child_process";

// Swallows stderr for calls whose failure is expected control flow (a ref that
// doesn't exist yet, a path absent at that revision) — the caller's catch
// already explains the case, so git's own "fatal:" line would just be noise.
export function gitQuiet(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

// Locally `origin` is this repo's fork and `upstream` is canonical; in CI,
// `origin` *is* canonical (GitHub Actions checks out the workflow's own repo
// under that name). Trying both in this order gets the right base in both
// places without hardcoding either.
export function resolveMergeBase() {
  for (const ref of ["upstream/main", "origin/main", "main"]) {
    try {
      gitQuiet(["rev-parse", "--verify", "--quiet", ref]);
    } catch {
      continue;
    }
    try {
      return gitQuiet(["merge-base", ref, "HEAD"]);
    } catch {
      continue;
    }
  }
  return null;
}
