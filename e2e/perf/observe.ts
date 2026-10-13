import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { docker, type Stack } from "./stack.ts";

/** #192's observation stack (`observe/compose.yml`): `pnpm perf:observe` starts it, and
 *  `PERF_OBSERVE=1` attaches each round. Diagnostics only — nothing here may fail a round. */
const DIR = path.join("e2e", "perf", "observe");
const COMPOSE = path.join(DIR, "compose.yml");
/** Bind-mounted into Prometheus (`compose.yml`), so a write plus `/-/reload` applies it. */
const GENERATED = path.join(DIR, "generated");
const PROMETHEUS_CONTAINER = "rmf-observe-prometheus";
const PROMETHEUS = "http://127.0.0.1:9090";
const GRAFANA = "http://127.0.0.1:3300";

export type Attached = { stack: Stack; network: string; run: string; round: number; names: Record<string, string> };
export type Mark = { time: number; timeEnd?: number; text: string };

/** The generated scrape file. cAdvisor names nothing on Docker Desktop (raw cgroup mode), so an
 *  attached round's container IDs are relabelled to their names; its Yorkie is scraped on the
 *  round's own network. JSON is valid YAML. */
export function scrapeConfig(attached?: Attached): string {
  const jobs: Array<object> = [
    {
      job_name: "cadvisor",
      static_configs: [{ targets: ["cadvisor:8080"] }],
      metric_relabel_configs: [
        // Only what the dashboard reads, before the per-ID rules run on every sample.
        { source_labels: ["__name__"], regex: "container_(cpu_usage_seconds_total|memory_working_set_bytes)", action: "keep" },
        ...Object.entries(attached?.names ?? {}).map(([id, name]) => ({
          source_labels: ["id"],
          regex: `.*${id}.*`,
          target_label: "name",
          replacement: name,
        })),
      ],
    },
  ];
  if (attached) {
    const yorkie = attached.stack.containers.find((name) => name.endsWith("-yorkie"));
    jobs.push({
      job_name: "yorkie",
      static_configs: [{ targets: [`${yorkie}:8081`], labels: { run: attached.run, round: String(attached.round) } }],
    });
  }
  return JSON.stringify({ scrape_configs: jobs }, null, 2);
}

async function apply(config: string) {
  await mkdir(GENERATED, { recursive: true });
  await writeFile(path.join(GENERATED, "scrape.yml"), config);
  const reload = await fetch(`${PROMETHEUS}/-/reload`, { method: "POST" });
  if (!reload.ok) throw new Error(`Prometheus reload: ${reload.status} ${await reload.text()}`);
}

export async function attach(stack: Stack, run: string, round: number): Promise<Attached> {
  // One line per container, in `stack.containers` order.
  const lines = (await docker(["inspect", "-f", "{{.Id}} {{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}", ...stack.containers]))
    .trim().split("\n").map((line) => line.split(" "));
  const network = lines[0][1];
  const names = Object.fromEntries(lines.map(([id], i) => [id, stack.containers[i]]));
  await docker(["network", "connect", network, PROMETHEUS_CONTAINER]);
  const attached = { stack, network, run, round, names };
  try {
    await apply(scrapeConfig(attached));
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
    await apply(scrapeConfig());
  } finally {
    await docker(["network", "disconnect", attached.network, PROMETHEUS_CONTAINER]);
  }
}

/** `pnpm perf:observe` (`observe-up.mts`): the stack up, with cAdvisor in the scrape file. */
export async function observeUp(): Promise<void> {
  // Created here, not by Docker, so the harness (not root) owns the bind-mounted directory.
  await mkdir(GENERATED, { recursive: true });
  await docker(["compose", "-f", COMPOSE, "up", "-d", "--wait"]);
  await apply(scrapeConfig());
  console.log(`Observation stack up. Grafana: ${GRAFANA} · Prometheus: ${PROMETHEUS}`);
  console.log(`Stop it after the run: docker compose -f ${COMPOSE} down`);
}
