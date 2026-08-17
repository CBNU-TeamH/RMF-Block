import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';

/**
 * Generic WebSocket connection registry + broadcaster — not chat-specific.
 * `ChatService` only depends on this through the `ChatBroadcaster` interface
 * (`lib/chat/types.ts`); this file never imports anything chat-related, so a
 * future feature (presence, etc.) can reuse it the same way (NFR-MAI-001).
 *
 * Cached on `globalThis`, same reason as `lib/host-secret.ts`: this module
 * gets loaded twice in one process — once by `server/index.mts` (Node's
 * native loader, no bundler) and once through Next's own bundled module
 * graph when `lib/chat/chat-service.ts` imports it. Without the cache, those
 * two loads would each hold a private connection registry, and a broadcast
 * from one side would never reach connections the other side registered.
 */
class WsHub {
  private readonly server = new WebSocketServer({ noServer: true });
  private readonly connections = new Set<WebSocket>();

  /** Called from `server/index.mts`'s `upgrade` handler. */
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.server.handleUpgrade(request, socket, head, (ws) => {
      this.connections.add(ws);
      ws.on('close', () => this.connections.delete(ws));
    });
  }

  broadcast(event: string, payload: unknown): void {
    const frame = JSON.stringify({ event, payload });
    for (const ws of this.connections) {
      if (ws.readyState === ws.OPEN) {
        ws.send(frame);
      }
    }
  }
}

const cache = globalThis as { __wsHub?: WsHub };

export const wsHub = (cache.__wsHub ??= new WsHub());
