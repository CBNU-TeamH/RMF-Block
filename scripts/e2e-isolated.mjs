import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = `rmf-e2e-${randomUUID().slice(0, 8)}`;
const password = `e2e-${randomUUID()}`;
const artifacts = path.join(root, "e2e-artifacts", project);
const directory = await mkdtemp(path.join(tmpdir(), `${project}-`));
const composeFile = path.join(directory, "compose.json");
const environment = { ...process.env, WORKSPACE_PASSWORD: password, HOST_LAN_IP: "127.0.0.1" };
let secret = "";
let created = false;
let interrupted = false;
let activeChild;

function redact(value) {
  let text = value.replace(/secret=[^\s"'<>]+/g, "secret=[REDACTED]");
  for (const credential of [secret, password]) {
    if (credential) text = text.replaceAll(credential, "[REDACTED]");
  }
  return text;
}

function command(program, args, { quiet = false, env = environment } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
    activeChild = child;
    let output = "";
    child.on("error", reject);
    for (const stream of [child.stdout, child.stderr]) {
      let pending = "";
      stream.on("data", (chunk) => {
        output += chunk.toString();
        if (!quiet) {
          pending += chunk.toString();
          const last = pending.lastIndexOf("\n");
          if (last >= 0) {
            process.stdout.write(redact(pending.slice(0, last + 1)));
            pending = pending.slice(last + 1);
          }
        }
      });
      stream.on("end", () => { if (!quiet && pending) process.stdout.write(redact(pending)); });
    }
    child.on("close", (code, signal) => {
      if (activeChild === child) activeChild = undefined;
      if (code === 0) resolve(output);
      else reject(new Error(`${program} ${args[0]} exited ${code ?? signal}\n${quiet ? redact(output) : "See command output above."}`));
    });
  });
}

const compose = (args, options) => command("docker", ["compose", "-p", project, "-f", composeFile, ...args], options);

async function available(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", (error) => reject(error.code === "EADDRINUSE"
      ? new Error(`E2E port 127.0.0.1:${port} is occupied; its owner was left running.`)
      : error));
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    interrupted = true;
    if (activeChild) {
      if (process.platform === "win32") activeChild.kill("SIGTERM");
      else process.kill(-activeChild.pid, "SIGTERM");
    }
  });
}

try {
  await available(3100);
  await available(8180);
  const config = JSON.parse(await command("docker", ["compose", "config", "--format", "json"], { quiet: true }));
  config.name = project;
  for (const [name, service] of Object.entries(config.services)) {
    service.container_name = `${project}-${name}`;
    service.restart = "no";
    if (name === "app") {
      service.image = `${project}-app`;
      service.build.context = root;
      service.ports = [{ target: 3000, published: "3100", host_ip: "127.0.0.1", protocol: "tcp" }];
      service.environment = {
        ...service.environment,
        HOST_LAN_IP: "127.0.0.1",
        WORKSPACE_PASSWORD: password,
        YORKIE_PORT: "8180",
      };
      delete service.environment.HOST_SECRET;
      delete service.environment.YORKIE_PUBLIC_ADDR;
    } else if (name === "yorkie") {
      service.ports = [{ target: 8080, published: "8180", host_ip: "127.0.0.1", protocol: "tcp" }];
    } else {
      delete service.ports;
    }
    for (const volume of service.volumes ?? []) {
      if (volume.type !== "volume" || !config.volumes?.[volume.source]) {
        throw new Error(`Refusing a non-project volume on ${name}.`);
      }
    }
  }
  for (const [name, volume] of Object.entries(config.volumes ?? {})) {
    if (volume.external || volume.driver_opts) throw new Error(`Refusing external volume ${name}.`);
    volume.name = `${project}-${name}`;
  }
  for (const [name, network] of Object.entries(config.networks ?? {})) {
    if (network.external) throw new Error(`Refusing external network ${name}.`);
    network.name = `${project}-${name}`;
  }
  await writeFile(composeFile, JSON.stringify(config), { mode: 0o600 });
  await mkdir(artifacts, { recursive: true });
  console.log(`Isolated project ${project}: app 127.0.0.1:3100, Yorkie 127.0.0.1:8180`);
  if (interrupted) throw new Error("E2E interrupted before startup.");
  created = true;
  await compose(["up", "-d", "--build", "--wait", "--wait-timeout", "180"]);
  let ready = false;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline && !interrupted) {
    const logs = await compose(["logs", "--no-color", "app"], { quiet: true });
    secret = logs.match(/Host:\s+http[^\s]*secret=([a-z0-9-]+)/)?.[1] ?? "";
    if (secret) {
      try {
        const response = await fetch("http://127.0.0.1:3100/join", { signal: AbortSignal.timeout(5000) });
        ready = response.ok;
      } catch (error) {
        if (error.cause?.code !== "ECONNREFUSED" && error.name !== "TimeoutError") throw error;
      }
      if (ready) break;
    }
    await delay(500);
  }
  if (!ready || interrupted) throw new Error("No ready host bootstrap banner (or interrupted).");
  await command("pnpm", ["e2e", ...process.argv.slice(2)], {
    env: {
      ...process.env,
      E2E_BASE_URL: "http://127.0.0.1:3100",
      E2E_WORKSPACE_PASSWORD: password,
      E2E_HOST_SECRET: secret,
      E2E_RUN_ID: project.slice(-8),
      E2E_JSON_REPORT: path.join(artifacts, "results.json"),
    },
  });
} catch (error) {
  console.error(redact(error.message));
  process.exitCode = 1;
} finally {
  if (created) {
    for (const name of ["playwright-report", "test-results"]) {
      try {
        await cp(path.join(root, name), path.join(artifacts, name), { recursive: true });
      } catch (error) {
        if (error.code !== "ENOENT") { console.error(error.message); process.exitCode = 1; }
      }
    }
    try {
      const logs = await compose(["logs", "--no-color", "app", "yorkie", "mongo"], { quiet: true });
      await writeFile(path.join(artifacts, "server.log"), redact(logs));
    } catch (error) {
      console.error(redact(error.message));
      process.exitCode = 1;
    }
    try {
      await compose(["down", "--volumes", "--remove-orphans"]);
      await command("docker", ["image", "rm", `${project}-app`]);
    } catch (error) {
      console.error(redact(error.message));
      process.exitCode = 1;
    }
  }
  await rm(directory, { recursive: true, force: true });
  if (interrupted) process.exitCode = 130;
}
