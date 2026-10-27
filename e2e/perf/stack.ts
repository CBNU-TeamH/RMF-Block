import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { appendFile, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

/** The release under measurement, pinned by digest (v0.1.0's release notes). */
export const APP_IMAGE =
  "ghcr.io/cbnu-teamh/rmf-block:0.1.0@sha256:b14f53c05ca2e9e3e54a55725e59eceeed0f822458d4daca4611f2723c58a9b1";

const exec = promisify(execFile);
export const docker = async (args: Array<string>, env?: Record<string, string>) =>
  (await exec("docker", args, { maxBuffer: 64 * 1024 * 1024, env: env && { ...process.env, ...env } })).stdout;

export type StackOptions = {
  project: string;
  dir: string;
  bind: string;
  host: string;
  appPort: number;
  yorkiePort: number;
  password: string;
};
export type Stack = StackOptions & { file: string; containers: Array<string> };

/** Throws if the port is taken, once `waitMs` has passed without it coming free. */
export async function free(host: string, port: number, waitMs = 0) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const server = net.createServer();
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      await new Promise((resolve) => server.close(resolve));
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
      if (Date.now() >= deadline) throw new Error(`Port ${host}:${port} is in use; stop whatever holds it.`);
      await delay(500);
    }
  }
}

type Service = {
  image?: string;
  container_name?: string;
  restart?: string;
  ports?: Array<object>;
  environment?: Record<string, string>;
  volumes?: Array<{ type: string; source: string }>;
};

/** One round's own Compose project, read from the base file only so the clone's override (a
 *  source build) never applies — the same renaming and refusals as `scripts/e2e-isolated.mjs`. */
export async function stackUp(options: StackOptions): Promise<Stack> {
  await Promise.all([free(options.bind, options.appPort), free(options.bind, options.yorkiePort)]);
  // Fresh per round, like the volume, in the shape `scripts/ensure-yorkie-secrets.sh` generates.
  const config = JSON.parse(await docker(
    ["compose", "-f", "docker-compose.yml", "config", "--format", "json"],
    { YORKIE_ADMIN_PASSWORD: `rmf1-${randomBytes(12).toString("hex")}`, YORKIE_ADMIN_TOKEN_SECRET: randomUUID() },
  )) as {
    name: string;
    services: Record<string, Service>;
    volumes?: Record<string, { name?: string; external?: boolean; driver_opts?: object }>;
    networks?: Record<string, { name?: string; external?: boolean }>;
  };
  config.name = options.project;
  const containers: Array<string> = [];
  for (const [name, service] of Object.entries(config.services)) {
    service.container_name = `${options.project}-${name}`;
    service.restart = "no";
    containers.push(service.container_name);
    for (const volume of service.volumes ?? []) {
      if (volume.type !== "volume" || !config.volumes?.[volume.source]) throw new Error(`Refusing a non-project volume on ${name}.`);
    }
  }
  const { app, yorkie } = config.services;
  app.image = APP_IMAGE;
  app.ports = [{ target: 3000, published: String(options.appPort), host_ip: options.bind, protocol: "tcp" }];
  app.environment = {
    ...app.environment,
    HOST_LAN_IP: options.host,
    WORKSPACE_NAME: "perf",
    WORKSPACE_PASSWORD: options.password,
    YORKIE_PORT: String(options.yorkiePort),
  };
  yorkie.ports = [{ target: 8080, published: String(options.yorkiePort), host_ip: options.bind, protocol: "tcp" }];
  for (const [name, volume] of Object.entries(config.volumes ?? {})) {
    if (volume.external || volume.driver_opts) throw new Error(`Refusing external volume ${name}.`);
    volume.name = `${options.project}-${name}`;
  }
  for (const [name, network] of Object.entries(config.networks ?? {})) {
    if (network.external) throw new Error(`Refusing external network ${name}.`);
    network.name = `${options.project}-${name}`;
  }
  const file = path.join(options.dir, "compose.json");
  await writeFile(file, JSON.stringify(config), { mode: 0o600 });
  const stack = { ...options, file, containers };
  try {
    await docker(["compose", "-p", options.project, "-f", file, "up", "-d", "--wait", "--wait-timeout", "180"]);
  } catch (error) {
    // A half-started project would hold its ports and volumes and block the next round.
    await stackDown(stack).catch(() => {});
    throw error;
  }
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://${options.host}:${options.appPort}/join`, { signal: AbortSignal.timeout(5000) })).ok) return stack;
    } catch {
      // not answering yet
    }
    await delay(500);
  }
  await stackDown(stack);
  throw new Error(`${options.project} never served /join.`);
}

/** Saves the round's server logs, then removes this project and its volumes — never another's. */
export async function stackDown(stack: Stack): Promise<void> {
  const compose = ["compose", "-p", stack.project, "-f", stack.file];
  try {
    await writeFile(path.join(stack.dir, "server.log"), await docker([...compose, "logs", "--no-color", "--timestamps"]));
  } finally {
    await docker([...compose, "down", "--volumes", "--remove-orphans"]);
  }
  // Docker Desktop releases the published ports a moment after `down` returns; the next round
  // would otherwise find them taken (#217).
  await Promise.all([free(stack.bind, stack.appPort, 60_000), free(stack.bind, stack.yorkiePort, 60_000)]);
}

/** `docker stats` for the round's containers every 5 s into `docker-stats.jsonl`, until `stop()`. */
export function sampleDockerStats(stack: Stack): { stop: () => Promise<void> } {
  let running = true;
  const file = path.join(stack.dir, "docker-stats.jsonl");
  const loop = (async () => {
    while (running) {
      const started = Date.now();
      try {
        const lines = await docker(["stats", "--no-stream", "--format", "{{json .}}", ...stack.containers]);
        const rows = lines.trim().split("\n").filter(Boolean).map((line) => JSON.stringify({ at: started, ...JSON.parse(line) }));
        await appendFile(file, rows.join("\n") + "\n");
      } catch (error) {
        await appendFile(file, JSON.stringify({ at: started, error: String(error) }) + "\n");
      }
      await delay(Math.max(0, 5000 - (Date.now() - started)));
    }
  })();
  return {
    stop: async () => {
      running = false;
      await loop;
    },
  };
}
