// Next.js client modules read process.env.* at load; the browser has no
// `process`. Imported first by entry.tsx so it runs before any of them.
(globalThis as { process?: unknown }).process ??= { env: {} };
