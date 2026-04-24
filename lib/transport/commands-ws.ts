/**
 * WebSocket command channel — socket.emit with .completed/.failed + ack.
 *
 * Supports two server patterns:
 *   1. AUDIT handlers — emit {event}.completed / {event}.failed
 *   2. CUSTOM handlers — fire-and-forget with ack callback
 *
 * Whichever responds first wins. Fire-and-forget calls resolve on ack.
 */
import type { AppSocket } from "@/contexts/socket-context";
import type { CommandChannel } from "./types";

type SocketLike = {
  emit: (
    event: string,
    data: unknown,
    cb?: (res: Record<string, unknown>) => void,
  ) => void;
  on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
  off: (
    event: string,
    handler: (data: Record<string, unknown>) => void,
  ) => void;
};

/** "/attempt/start" → "attempt.start" */
function toWsEvent(endpoint: string): string {
  return endpoint.replace(/^\//, "").replace(/\//g, ".");
}

const SEND_TIMEOUT_MS = 30_000;

export function createWsCommands(socket: AppSocket): CommandChannel {
  const s = socket as unknown as SocketLike;

  const send: CommandChannel["send"] = async (endpoint, body) => {
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

      const onCompleted = (data: Record<string, unknown>) => settle(data);
      const onFailed = (data: Record<string, unknown>) =>
        fail((data["message"] as string) || "Operation failed");

      s.on(`${event}.completed`, onCompleted);
      s.on(`${event}.failed`, onFailed);

      timer = setTimeout(
        () => fail(`WS send timed out: ${event}`),
        SEND_TIMEOUT_MS,
      );

      s.emit(event, body, (ackRes) => {
        if (ackRes && typeof ackRes === "object" && "error" in ackRes) {
          fail(String(ackRes["error"]));
        } else {
          settle(ackRes ?? {});
        }
      });
    });
  };

  return { send };
}
