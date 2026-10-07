import { expect, type Page } from "@playwright/test";

/** Observe actual streaming requests and socket events, then sever both transports.
 * Chromium offline alone does not reliably close an already-open WebSocket. */
export async function networkProbe(page: Page, socketPath: "chat" | "workspace") {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  const watches = new Set<string>();
  let endedWatches = 0;
  cdp.on("Network.responseReceived", (event) => {
    if (event.response.url.includes("/yorkie.v1.YorkieService/Watch")) watches.add(event.requestId);
  });
  const ended = (event: { requestId: string }) => {
    if (watches.delete(event.requestId)) endedWatches++;
  };
  cdp.on("Network.loadingFailed", ended);
  cdp.on("Network.loadingFinished", ended);
  await page.addInitScript(() => {
    const nativeFetch = window.fetch;
    const watches: AbortController[] = [];
    (window as Window & { e2eWatchControllers?: AbortController[] }).e2eWatchControllers = watches;
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.includes("/yorkie.v1.YorkieService/Watch")) return nativeFetch(input, init);
      const controller = new AbortController();
      watches.push(controller);
      const original = init?.signal ?? (input instanceof Request ? input.signal : null);
      return nativeFetch(input, {
        ...init,
        signal: original ? AbortSignal.any([original, controller.signal]) : controller.signal,
      });
    };
    const Native = window.WebSocket;
    const events: { url: string; type: string }[] = [];
    const sockets: WebSocket[] = [];
    (window as Window & { e2eSocketEvents?: typeof events }).e2eSocketEvents = events;
    (window as Window & { e2eSockets?: WebSocket[] }).e2eSockets = sockets;
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        sockets.push(this);
        for (const type of ["open", "close"]) {
          this.addEventListener(type, () => events.push({ url: String(url), type }));
        }
      }
    };
  });
  const events = (type: string) => page.evaluate(({ type, path }) => {
    return ((window as Window & { e2eSocketEvents?: Array<{ url: string; type: string }> }).e2eSocketEvents ?? [])
      .filter((event) => event.type === type && event.url.endsWith(`/api/${path}/ws`)).length;
  }, { type, path: socketPath });

  return {
    ready: async () => {
      await expect.poll(() => watches.size).toBeGreaterThan(0);
      await expect.poll(() => events("open")).toBeGreaterThan(0);
    },
    disconnect: async (offline: boolean) => {
      const before = await events("close");
      const endedBefore = endedWatches;
      if (offline) await page.context().setOffline(true);
      await page.evaluate(({ path, offline }) => {
        const sockets = (window as Window & { e2eSockets?: WebSocket[] }).e2eSockets ?? [];
        for (const socket of sockets) {
          if (socket.url.endsWith(`/api/${path}/ws`)) socket.close(4000, "E2E outage");
        }
        if (offline) {
          const controllers = (window as Window & { e2eWatchControllers?: AbortController[] }).e2eWatchControllers ?? [];
          for (const controller of controllers) controller.abort(new TypeError("E2E network disconnected"));
        }
      }, { path: socketPath, offline });
      await expect.poll(() => events("close")).toBeGreaterThan(before);
      if (offline) await expect.poll(() => endedWatches).toBeGreaterThan(endedBefore);
    },
    restore: async () => {
      await page.context().setOffline(false);
    },
    opens: () => events("open"),
  };
}
