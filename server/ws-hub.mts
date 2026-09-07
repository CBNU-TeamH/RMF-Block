import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';

/** Generic WebSocket registry and broadcaster — nothing chat-specific is
 *  imported here, so a future feature can reuse it through `ChatBroadcaster`
 *  (NFR-MAI-001). A connection may carry a session id, which is what makes
 *  FR-020-08's takeover visible; a connection without one still works. On
 *  `globalThis` like `lib/host-secret.ts`: loaded twice in one process. What
 *  this layer must do, and what an unauthenticated socket can: `chat.md`. */

/** Close code for a socket the server dropped on purpose. 4000-4999 is the
 * range reserved for application use, so it cannot collide with a protocol code. */
const REVOKED_CLOSE_CODE = 4001;

class WsHub {
  private readonly server = new WebSocketServer({ noServer: true });
  private readonly connections = new Map<WebSocket, string | null>();

  /** Called from `server/index.mts`'s `upgrade` handler. */
  handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    sessionId: string | null = null,
  ): void {
    this.server.handleUpgrade(request, socket, head, (ws) => {
      this.connections.set(ws, sessionId);
      // Without this listener EventEmitter rethrows and takes the process down
      // (`docs/design/chat.md`).
      ws.on('error', (error) => {
        console.error('ws connection error', error);
        ws.close();
      });
      ws.on('close', () => this.connections.delete(ws));
    });
  }

  broadcast(event: string, payload: unknown): void {
    const frame = JSON.stringify({ event, payload });
    for (const ws of this.connections.keys()) {
      if (ws.readyState === ws.OPEN) {
        ws.send(frame);
      }
    }
  }

  /** Tell every socket held by `sessionId` it was displaced, then close it —
   *  message first (`docs/design/chat.md`). */
  revoke(sessionId: string): void {
    const frame = JSON.stringify({ event: 'session:revoked', payload: null });

    for (const [ws, id] of this.connections) {
      if (id !== sessionId) continue;
      if (ws.readyState === ws.OPEN) {
        ws.send(frame);
      }
      ws.close(REVOKED_CLOSE_CODE, 'session revoked');
    }
  }
}

const cache = globalThis as { __wsHub?: WsHub };

export const wsHub = (cache.__wsHub ??= new WsHub());
