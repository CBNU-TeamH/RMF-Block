import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const redact = (text: string) => text.replace(/secret=[^\s"'<>]+/g, "secret=[REDACTED]");

/** `docker compose` against the disposable stack `pnpm e2e:isolated --lifecycle` started. Only
 *  that runner sets the two variables: a spec that restarts a stack must never find a real one. */
export async function compose(...args: string[]): Promise<string> {
  const project = process.env.E2E_COMPOSE_PROJECT;
  const file = process.env.E2E_COMPOSE_FILE;
  if (!project || !file) throw new Error("Run lifecycle specs with `pnpm e2e:isolated --lifecycle`.");
  try {
    const { stdout, stderr } = await run("docker", ["compose", "-p", project, "-f", file, ...args], { maxBuffer: 32 * 1024 * 1024 });
    return `${stdout}${stderr}`;
  } catch (error) {
    throw new Error(redact(error instanceof Error ? error.message : String(error)));
  }
}

/** Like `compose`, for a command that is expected to fail: its exit status and what it printed. */
export async function composeOutcome(...args: string[]): Promise<{ ok: boolean; output: string }> {
  try {
    return { ok: true, output: await compose(...args) };
  } catch (error) {
    return { ok: false, output: error instanceof Error ? error.message : String(error) };
  }
}

/** Everything the app container has printed so far, startup banners included, secrets removed. */
export async function appLog(): Promise<string> {
  return redact(await compose("logs", "--no-color", "app"));
}

/** Waits for the app to answer, after a restart or a kill. `/join` is served whether or not the workspace is open. */
export async function appReady(timeout = 120_000): Promise<void> {
  const url = `${process.env.E2E_BASE_URL}/join`;
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(5000) })).ok) return;
    } catch {
      // Still starting: refused or timed out.
    }
    if (Date.now() > deadline) throw new Error(`The app did not answer ${url} within ${timeout / 1000}s.`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
