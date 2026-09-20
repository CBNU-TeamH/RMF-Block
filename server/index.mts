/**
 * Custom server entry point — replaces `next dev`/`next start`. Required
 * because WebSocket upgrades never reach a Route Handler (Next 16.2.12 has no
 * `SOCKET` export support, and `output: "standalone"` cannot coexist with a
 * custom server either — see `docs/design/chat.md`). One HTTP server, one
 * port: normal requests go to Next, `Upgrade: websocket` requests to
 * `/api/chat/ws` and `/api/workspace/ws` go to `ws-hub.mts`, everything else
 * (Next's own dev-mode HMR socket) goes to Next's own upgrade handler so Fast
 * Refresh keeps working.
 */
import { createServer } from 'node:http';
import next from 'next';

import { isAuthenticatedSocket, readSessionCookie } from '../lib/auth/session-cookie.ts';
import { sessionRegistry } from '../lib/auth/session-registry.ts';
import { wsHub } from './ws-hub.mts';

const CHAT_WS_PATH = '/api/chat/ws';
// A separate URL from the workspace socket, but the same wsHub singleton and
// the same indiscriminate broadcast() — so the auth gate below has to apply
// to both paths equally, or either one alone is a bypass of the other (#83).
const WORKSPACE_WS_PATH = '/api/workspace/ws';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handleRequest = app.getRequestHandler();

await app.prepare();

// Only available once `prepare()` has resolved — it reads internal state that
// doesn't exist before then, unlike `getRequestHandler()`'s lazily-evaluated one.
const handleNextUpgrade = app.getUpgradeHandler();

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error('request handler error', error);
    res.statusCode = 500;
    res.end('internal server error');
  });
});

server.on('upgrade', (req, socket, head) => {
  if (req.url === CHAT_WS_PATH || req.url === WORKSPACE_WS_PATH) {
    // Read once, here rather than in the hub: this is the only place the raw
    // request exists, and both the auth check below and the `handleUpgrade`
    // call after it need the same value — parsing the header twice for the
    // identical cookie would cost that on every upgrade for nothing.
    const sessionId = readSessionCookie(req.headers.cookie);

    // Reject the upgrade itself rather than completing the handshake and
    // closing right after — an unauthenticated client is never registered in
    // wsHub at all (#83: anyone on the LAN could otherwise read the document
    // catalogue and chat off either path).
    if (!isAuthenticatedSocket(sessionId, req.headers.cookie)) {
      // `end()`, not `write()` + `destroy()`: `destroy()` can drop whatever is
      // still buffered, so the 401 might never actually reach the client under
      // backpressure. `end()` flushes first; `ws`'s own `abortHandshake` uses
      // the identical shape (write, then destroy once `'finish'` fires).
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    // Only the workspace socket is filed under a session, so `revoke()` can
    // find it again once that session is displaced (FR-020-08) — chat's
    // connections still carry none. The registry is also re-checked right
    // here, not just at `revoke()` time — a session displaced between the
    // auth check above and this connection actually registering would
    // otherwise register anyway and never be told (#26).
    wsHub.handleUpgrade(
      req,
      socket,
      head,
      req.url === WORKSPACE_WS_PATH ? sessionId : null,
      (id) => sessionRegistry.resolve(id) !== null,
    );
    return;
  }
  handleNextUpgrade(req, socket, head).catch((error) => {
    console.error('upgrade handler error', error);
    socket.destroy();
  });
});

server.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});
