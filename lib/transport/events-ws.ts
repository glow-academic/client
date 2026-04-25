/**
 * WebSocket event channel — thin wrapper over socket.on/off.
 * Used by ws and http-ws modes.
 */
import type { AppSocket } from "@/contexts/socket-context";
import type { EventChannel } from "./types";

export function createWsEvents(socket: AppSocket): EventChannel {
  const s = socket as unknown as {
    on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
    off: (event: string, handler: (data: Record<string, unknown>) => void) => void;
  };

  return {
    // `scope` is ignored — WS uses one multiplexed socket; group filtering
    // happens server-side via the publish path's group_id.
    on(event, handler, _scope) {
      s.on(event, handler);
      return () => s.off(event, handler);
    },
  };
}
