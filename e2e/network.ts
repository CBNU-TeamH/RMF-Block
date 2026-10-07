import { expect, type Page } from "@playwright/test";

export const YORKIE_SERVICE = "/yorkie.v1.YorkieService/";

/** Cut a page off from Yorkie and observe it happen. Chromium's offline toggle
 *  stops new requests but can leave a live Watch stream open, so those are
 *  aborted too. Install before the page navigates: it patches `fetch`. */
export async function yorkieCut(page: Page) {
  const watch = `${YORKIE_SERVICE}Watch`;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  const watches = new Set<string>();
  let endedWatches = 0;
  cdp.on("Network.responseReceived", (event) => {
    if (event.response.url.includes(watch)) watches.add(event.requestId);
  });
  const ended = (event: { requestId: string }) => {
    if (watches.delete(event.requestId)) endedWatches++;
  };
  cdp.on("Network.loadingFailed", ended);
  cdp.on("Network.loadingFinished", ended);
  await page.addInitScript((watch) => {
    const nativeFetch = window.fetch;
    const watches: AbortController[] = [];
    (window as Window & { e2eWatchControllers?: AbortController[] }).e2eWatchControllers = watches;
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.includes(watch)) return nativeFetch(input, init);
      const controller = new AbortController();
      watches.push(controller);
      const original = init?.signal ?? (input instanceof Request ? input.signal : null);
      return nativeFetch(input, {
        ...init,
        signal: original ? AbortSignal.any([original, controller.signal]) : controller.signal,
      });
    };
  }, watch);

  return {
    ready: () => expect.poll(() => watches.size).toBeGreaterThan(0),
    disconnect: async () => {
      const endedBefore = endedWatches;
      await page.context().setOffline(true);
      await page.evaluate(() => {
        const controllers = (window as Window & { e2eWatchControllers?: AbortController[] }).e2eWatchControllers ?? [];
        for (const controller of controllers) controller.abort(new TypeError("E2E network disconnected"));
      });
      await expect.poll(() => endedWatches).toBeGreaterThan(endedBefore);
    },
    restore: () => page.context().setOffline(false),
  };
}

/** `yorkieCut` plus one of the app's sockets, observed through open/close
 *  events. The page closes the socket itself (code 4000) rather than losing it
 *  (1006): a recovery path that tells the two apart would need a server-side
 *  cut instead. */
export async function networkProbe(page: Page, socketPath: "chat" | "workspace") {
  const yorkie = await yorkieCut(page);
  await page.addInitScript(() => {
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
      await yorkie.ready();
      await expect.poll(() => events("open")).toBeGreaterThan(0);
    },
    disconnect: async (offline: boolean) => {
      const before = await events("close");
      if (offline) await yorkie.disconnect();
      await page.evaluate((path) => {
        const sockets = (window as Window & { e2eSockets?: WebSocket[] }).e2eSockets ?? [];
        for (const socket of sockets) {
          if (socket.url.endsWith(`/api/${path}/ws`)) socket.close(4000, "E2E outage");
        }
      }, socketPath);
      await expect.poll(() => events("close")).toBeGreaterThan(before);
    },
    restore: yorkie.restore,
    opens: () => events("open"),
  };
}
