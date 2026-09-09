import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    // A DOM-touching file opts in with a first-line
    // `// @vitest-environment happy-dom` pragma instead of a config-side
    // glob — environmentMatchGlobs's key names have churned across Vitest
    // versions, the pragma hasn't. happy-dom, not jsdom: jsdom 30 doesn't
    // implement dialog.showModal() (needed by document-list.tsx /
    // join-form.tsx); happy-dom does. See docs/adr/004-test-runner-migration.md.
    //
    // "forks", and nothing else: the existing suite writes to tmpdir() and
    // mutates process.env, so sharing a worker process across files would
    // leak state. That's the only reason for this setting — no worker-count
    // tuning. If a run times out, suspect the worker count first: Vitest
    // defaults to 50% of cores and floors to 1 on a low-core machine.
    pool: "forks",
  },
});
