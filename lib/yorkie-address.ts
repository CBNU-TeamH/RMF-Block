const DEFAULT_YORKIE_PORT = 8080;

export type YorkieClientConfig = {
  /** A complete address that wins outright, for a Yorkie on another machine. */
  override: string | null;
  /** Port to reach Yorkie on, alongside whichever host the page came from. */
  port: number;
};

/**
 * What the browser cannot work out for itself — and deliberately *not* the host.
 *
 * Resolving the host here was a real bug: the server handed every client the LAN
 * address, so a page opened at `localhost:3000` was told to fetch
 * `192.168.0.9:8080`. That leaves the loopback address space for the private one,
 * and desktop Chrome, Brave, and Firefox all refused it while a phone — already
 * on the LAN address, so not crossing anything — connected fine.
 *
 * Whatever host someone typed to reach the app is by definition a host they can
 * reach, so the client pairs that host with this port instead.
 */
export function yorkieClientConfig(): YorkieClientConfig {
  const port = Number(process.env.YORKIE_PORT ?? DEFAULT_YORKIE_PORT);

  return {
    override: process.env.YORKIE_PUBLIC_ADDR || null,
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_YORKIE_PORT,
  };
}
