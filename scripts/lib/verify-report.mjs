// Shared by the scripts/verify-*.mjs scripts — plain node scripts run against
// a live server rather than vitest (see each script's own header for why).
// Extracted after the same report-line format was independently copied into
// three of them and had already drifted (different padEnd widths, nothing
// keeping them in sync).

/** Tracks pass/fail across a script's cases and prints one line per case.
 *  `labelWidth`/`expectedWidth` only control column alignment — pass the
 *  values a script already used to keep its output unchanged. */
export function createReporter({ labelWidth = 46, expectedWidth = 10 } = {}) {
  let failures = 0;
  const report = (label, expected, actual) => {
    const ok = expected === actual;
    if (!ok) failures += 1;
    console.log(
      `  ${ok ? "✅" : "❌"} ${label.padEnd(labelWidth)} 기대=${String(expected).padEnd(expectedWidth)} 실제=${actual}`,
    );
  };
  return {
    report,
    get failures() {
      return failures;
    },
  };
}

/** Fails fast — exit code 2, distinct from a failed case's 1 — when a target
 *  this script needs isn't up, so it reports "nothing is running" once
 *  instead of every case reporting "blocked" individually. */
export async function requireReachable(targets) {
  for (const [name, url] of targets) {
    try {
      await fetch(url);
    } catch {
      console.error(`\n  ${name} is not reachable. Start it and try again.\n`);
      process.exit(2);
    }
  }
}
