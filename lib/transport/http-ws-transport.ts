/**
 * HTTP + WebSocket transport — commands via HTTP, events via socket.io.
 * Balanced mode: typed server actions for commands, real-time for events.
 */
import { api } from "@/lib/api/client";
import type { AppSocket } from "@/contexts/socket-context";
import type { Transport } from "./types";

export function createHttpWsTransport(socket: AppSocket): Transport {
  return {
    mode: "http-ws",

    async send(endpoint, body) {
      // Use the HTTP API client — goes through Next.js server actions path
      return api.post(endpoint as Parameters<typeof api.post>[0], { body }) as Promise<Record<string, unknown>>;
    },

    on(event, handler) {
      const s = socket as unknown as {
        on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
        off: (event: string, handler: (data: Record<string, unknown>) => void) => void;
      };
      s.on(event, handler);
      return () => s.off(event, handler);
    },
  };
}
