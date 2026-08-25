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

import { readSessionCookie } from '../lib/auth/session-cookie.ts';
import { wsHub } from './ws-hub.mts';

const CHAT_WS_PATH = '/api/chat/ws';
// Separate from chat's socket on purpose. Chat is a teammate's experiment and
// stays untouched: its upgrade path is byte-for-byte what it was, and its
// connections still carry no session.
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
  if (req.url === CHAT_WS_PATH) {
    wsHub.handleUpgrade(req, socket, head);
    return;
  }
  if (req.url === WORKSPACE_WS_PATH) {
    // Read here rather than in the hub: this is the only place the raw request
    // exists. The socket is filed under whatever session the browser sent, so
    // `revoke()` can find it again once that session is displaced (FR-020-08).
    wsHub.handleUpgrade(req, socket, head, readSessionCookie(req.headers.cookie));
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
