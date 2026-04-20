/**
 * Full WebSocket transport — commands + events over socket.io.
 * Power mode: single connection, lowest latency.
 *
 * send() supports two server-side patterns:
 *   1. AUDIT handlers — emit {event}.completed / {event}.failed (request/response)
 *   2. CUSTOM handlers — fire-and-forget, no .completed event
 *
 * Strategy: listen for .completed/.failed AND use the ack callback.
 * Whichever responds first wins. For fire-and-forget calls, the ack
 * resolves immediately with an empty object.
 */
import type { AppSocket } from "@/contexts/socket-context";
import type { Transport } from "./types";

type SocketLike = {
  emit: (event: string, data: unknown, cb?: (res: Record<string, unknown>) => void) => void;
  on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
  off: (event: string, handler: (data: Record<string, unknown>) => void) => void;
};

/** Convert HTTP-style path to dot-separated WS event name: "/attempt/start" → "attempt.start" */
function toWsEvent(endpoint: string): string {
  return endpoint.replace(/^\//, "").replace(/\//g, ".");
}

const SEND_TIMEOUT_MS = 30_000;

export function createWsTransport(socket: AppSocket): Transport {
  const s = socket as unknown as SocketLike;

  return {
    mode: "ws",

    async send(endpoint, body) {
      const event = toWsEvent(endpoint);

      return new Promise((resolve, reject) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
          if (timer) clearTimeout(timer);
          s.off(`${event}.completed`, onCompleted);
          s.off(`${event}.failed`, onFailed);
        };

        const settle = (value: Record<string, unknown>) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(value);
        };

        const fail = (reason: string) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error(reason));
        };

        // Pattern 1: AUDIT handlers emit .completed / .failed
        const onCompleted = (data: Record<string, unknown>) => settle(data);
        const onFailed = (data: Record<string, unknown>) =>
          fail((data.message as string) || "Operation failed");

        s.on(`${event}.completed`, onCompleted);
        s.on(`${event}.failed`, onFailed);

        timer = setTimeout(() => fail(`WS send timed out: ${event}`), SEND_TIMEOUT_MS);

        // Pattern 2: ack callback — for CUSTOM handlers or as fallback
        s.emit(event, body, (ackRes) => {
          if (ackRes && typeof ackRes === "object" && "error" in ackRes) {
            fail(String(ackRes.error));
          } else {
            settle(ackRes ?? {});
          }
        });
      });
    },

    on(event, handler) {
      s.on(event, handler);
      return () => s.off(event, handler);
    },
  };
}
