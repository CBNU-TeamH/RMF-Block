import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';

/** Generic WebSocket registry and broadcaster — nothing chat-specific is
 *  imported here, so a future feature can reuse it through `ChatBroadcaster`
 *  (NFR-MAI-001). Presence did not: it rides Yorkie's own attach, so the only
 *  other thing on this socket is `session:revoked`.
 *
 *  A connection may carry a session id, which is what makes FR-020-08's takeover
 *  visible — `revoke()` closes the sockets a displaced session still holds.
 *  Connections without one keep working; chat never authenticated.
 *
 *  On `globalThis` like `lib/host-secret.ts`: loaded twice in one process, and
 *  two private registries would mean a broadcast from one side never reaching
 *  the other's connections. */

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
      // A protocol error (a malformed frame) or a failed send emits 'error' on
      // the socket. With no listener, EventEmitter rethrows it and takes the
      // whole process down — Next included, since this is one process.
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

  /**
   * Tell every socket held by `sessionId` that it has been displaced, then close
   * it. The message goes first: a client that only saw the close would have to
   * guess whether it was evicted or the network dropped, and those want
   * different handling.
   */
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
