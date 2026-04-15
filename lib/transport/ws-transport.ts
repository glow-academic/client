/**
 * Full WebSocket transport — commands + events over socket.io.
 * Power mode: single connection, lowest latency.
 */
import type { AppSocket } from "@/contexts/socket-context";
import type { Transport } from "./types";

export function createWsTransport(socket: AppSocket): Transport {
  return {
    mode: "ws",

    async send(endpoint, body) {
      return new Promise((resolve, reject) => {
        // socket.io acknowledgement pattern — server returns response via callback
        (socket as unknown as {
          emit: (event: string, data: unknown, cb: (res: Record<string, unknown>) => void) => void;
        }).emit(endpoint, body, (res) => {
          if (res && typeof res === "object" && "error" in res) {
            reject(new Error(String(res.error)));
          } else {
            resolve(res ?? {});
          }
        });
      });
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
