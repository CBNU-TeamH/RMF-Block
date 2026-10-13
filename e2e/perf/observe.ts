import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { docker, type Stack } from "./stack.ts";

/** #192's observation stack (`observe/compose.yml`): `pnpm perf:observe` starts it, and
 *  `PERF_OBSERVE=1` attaches each round. Diagnostics only — nothing here may fail a round. */
const COMPOSE = path.join("e2e", "perf", "observe", "compose.yml");
const PROMETHEUS_CONTAINER = "rmf-observe-prometheus";
export const PROMETHEUS = "http://127.0.0.1:9090";
export const GRAFANA = "http://127.0.0.1:3300";

export type Attached = { stack: Stack; network: string; run: string; round: number; names: Record<string, string> };
export type Mark = { time: number; timeEnd?: number; text: string };

/** The generated scrape file. cAdvisor names nothing on Docker Desktop (raw cgroup mode), so an
 *  attached round's container IDs are relabelled to their names; its Yorkie is scraped on the
 *  round's own network. JSON is valid YAML. */
export function scrapeConfig(attached?: Pick<Attached, "stack" | "run" | "round" | "names">): string {
  const jobs: Array<object> = [
    {
      job_name: "cadvisor",
      static_configs: [{ targets: ["cadvisor:8080"] }],
      metric_relabel_configs: Object.entries(attached?.names ?? {}).map(([id, name]) => ({
        source_labels: ["id"],
        regex: `.*${id}.*`,
        target_label: "name",
        replacement: name,
      })),
    },
  ];
  if (attached) {
    jobs.push({
      job_name: "yorkie",
      static_configs: [{ targets: [`${attached.stack.project}-yorkie:8081`], labels: { run: attached.run, round: String(attached.round) } }],
    });
  }
  return JSON.stringify({ scrape_configs: jobs }, null, 2);
}

async function apply(config: string, dir: string) {
  const file = path.join(dir, "scrape.yml");
  await writeFile(file, config);
  await docker(["cp", file, `${PROMETHEUS_CONTAINER}:/etc/prometheus/generated/scrape.yml`]);
  const reload = await fetch(`${PROMETHEUS}/-/reload`, { method: "POST" });
  if (!reload.ok) throw new Error(`Prometheus reload: ${reload.status} ${await reload.text()}`);
}

export async function attach(stack: Stack, run: string, round: number): Promise<Attached> {
  const inspect = (format: string) => docker(["inspect", "-f", format, ...stack.containers]);
  const network = (await inspect("{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}")).split("\n")[0].trim();
  const names = Object.fromEntries((await inspect("{{.Id}} {{.Name}}")).trim().split("\n").map((line) => {
    const [id, name] = line.split(" ");
    return [id, name.replace(/^\//, "")];
  }));
  await docker(["network", "connect", network, PROMETHEUS_CONTAINER]);
  const attached = { stack, network, run, round, names };
  try {
    await apply(scrapeConfig(attached), stack.dir);
  } catch (error) {
    // A connected Prometheus would keep `compose down` from removing the round's network.
    await docker(["network", "disconnect", network, PROMETHEUS_CONTAINER]).catch(() => {});
    throw error;
  }
  return attached;
}

/** Before `stackDown`: the marks go to Grafana, the round leaves the scrape file, and Prometheus
 *  leaves the round's network so `compose down` can remove it. */
export async function detach(attached: Attached, marks: Array<Mark>): Promise<void> {
  const tags = ["rmf-perf", attached.run, `round-${attached.round}`];
  await Promise.allSettled(marks.map((mark) =>
    fetch(`${GRAFANA}/api/annotations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...mark, time: Math.round(mark.time), timeEnd: mark.timeEnd && Math.round(mark.timeEnd), tags }),
    })));
  try {
    await apply(scrapeConfig(), attached.stack.dir);
  } finally {
    await docker(["network", "disconnect", attached.network, PROMETHEUS_CONTAINER]);
  }
}

/** `pnpm perf:observe` (`observe-up.mts`): the stack up, with cAdvisor in the scrape file. */
export async function observeUp(): Promise<void> {
  await docker(["compose", "-f", COMPOSE, "up", "-d", "--wait"]);
  await apply(scrapeConfig(), await mkdtemp(path.join(os.tmpdir(), "rmf-observe-")));
  console.log(`Observation stack up. Grafana: ${GRAFANA} · Prometheus: ${PROMETHEUS}`);
  console.log(`Stop it after the run: docker compose -f ${COMPOSE} down`);
}
