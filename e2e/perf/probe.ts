/** One probe record, on this page's clock (`performance.timeOrigin` + a stamp). */
export type ProbeEvent = {
  kind: "send" | "recv" | "move";
  item: "002" | "003" | "004" | "005";
  marker: string;
  t: number;
};

export type PerfWindow = Window & {
  __perf?: Array<ProbeEvent>;
  /** Presenter: the scroll that puts this block at the top is 005's t0. */
  __perfLead?: { marker: string; block: string };
  /** Follower: the scroll that brings this block to the top is 005's t1. */
  __perfFollow?: { marker: string; block: string };
};

/** Markers look like `~m:<round>:<client>:<kind>:<seq>~`; kind `e`/`o` is a block edit (`o` while
 *  G is cut off), `c` a chat message. */
export const marker = (round: number, client: string, kind: string, seq: number) => `~m:${round}:${client}:${kind}:${seq}~`;

/** Installed with `addInitScript` on H's and G's measuring pages — no product code. t0 is the
 *  sender event's own `timeStamp`; t1 is taken after a double rAF, once the change has painted.
 *  The log is mirrored into `sessionStorage` so a full navigation does not lose it. */
export function installProbe(me: string): void {
  const w = window as PerfWindow;
  const log: Array<ProbeEvent> = JSON.parse(sessionStorage.getItem("perf-log") ?? "[]");
  w.__perf = log;
  const seen = new Set(log.map((event) => event.kind + event.marker));
  const record = (event: ProbeEvent) => {
    if (seen.has(event.kind + event.marker)) return;
    seen.add(event.kind + event.marker);
    log.push(event);
    sessionStorage.setItem("perf-log", JSON.stringify(log));
  };
  const at = (stamp: number) => performance.timeOrigin + stamp;
  const painted = (then: (t: number) => void) =>
    requestAnimationFrame(() => requestAnimationFrame(() => then(at(performance.now()))));
  const markers = (text: string, kinds: string) =>
    (text.match(/~m:[^~\s]+~/g) ?? []).filter((found) => kinds.includes(found.split(":")[3]));
  const mine = (found: string) => found.split(":")[2] === me;
  const received = (item: ProbeEvent["item"], found: string) => {
    if (!mine(found) && !seen.has("recv" + found)) painted((t) => record({ kind: "recv", item, marker: found, t }));
  };

  // 002: a remote edit lands as `el.value = …`, which no MutationObserver sees.
  const native = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!;
  Object.defineProperty(HTMLTextAreaElement.prototype, "value", {
    ...native,
    set(this: HTMLTextAreaElement, value: string) {
      native.set!.call(this, value);
      for (const found of markers(String(value), "eo")) received("002", found);
    },
  });
  document.addEventListener("input", (event) => {
    if (!(event.target instanceof HTMLTextAreaElement)) return;
    for (const found of markers(event.target.value, "eo")) {
      if (mine(found)) record({ kind: "send", item: "002", marker: found, t: at(event.timeStamp) });
    }
  }, true);

  // 004 send, and 003's t0 (the join form's submit).
  document.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest?.("button");
    const label = button?.textContent?.trim();
    if (label === "입장") record({ kind: "send", item: "003", marker: "join", t: at(event.timeStamp) });
    if (label !== "전송") return;
    const draft = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="채팅 메시지"]')?.value ?? "";
    for (const found of markers(draft, "c")) {
      if (mine(found)) record({ kind: "send", item: "004", marker: found, t: at(event.timeStamp) });
    }
  }, true);

  // 004 receipt, and 003's t1: the tree lists the seeded document and the banner counts everyone.
  const joined = () => {
    const expected = sessionStorage.getItem("perf-join");
    if (!expected) return;
    const { doc, count } = JSON.parse(expected) as { doc: string; count: number };
    const tree = [...document.querySelectorAll("aside a")].some((link) => link.textContent?.includes(doc));
    const roster = [...document.querySelectorAll("header")].some((header) => header.textContent?.includes(`${count}명 접속 중`));
    if (!tree || !roster) return;
    sessionStorage.removeItem("perf-join");
    painted((t) => record({ kind: "recv", item: "003", marker: "join", t }));
  };
  new MutationObserver((records) => {
    for (const change of records) {
      change.addedNodes.forEach((node) => markers(node.textContent ?? "", "c").forEach((found) => received("004", found)));
      if (change.type === "characterData") markers(change.target.textContent ?? "", "c").forEach((found) => received("004", found));
    }
    joined();
  }).observe(document, { subtree: true, childList: true, characterData: true });

  // 005: the presenter's scroll that puts the block at the top, the follower's arrival at ±8 px.
  const offset = (box: Element, block: string) =>
    (box.querySelector(`[data-block-id="${block}"]`)?.getBoundingClientRect().top ?? Infinity) - box.getBoundingClientRect().top;
  document.addEventListener("scroll", (event) => {
    const box = event.target;
    if (!(box instanceof HTMLElement) || !box.hasAttribute("data-focus-scroll")) return;
    const lead = w.__perfLead;
    if (lead && Math.abs(offset(box, lead.block)) <= 1) {
      w.__perfLead = undefined;
      record({ kind: "send", item: "005", marker: lead.marker, t: at(event.timeStamp) });
    }
    if (w.__perfFollow) record({ kind: "move", item: "005", marker: w.__perfFollow.marker, t: at(event.timeStamp) });
  }, true);
  document.addEventListener("scrollend", (event) => {
    const box = event.target;
    const follow = w.__perfFollow;
    if (!follow || !(box instanceof HTMLElement) || !box.hasAttribute("data-focus-scroll")) return;
    if (Math.abs(offset(box, follow.block)) > 8) return;
    w.__perfFollow = undefined;
    painted((t) => record({ kind: "recv", item: "005", marker: follow.marker, t }));
  }, true);
}
