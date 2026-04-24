/**
 * SSE event channel — maintains a single EventSource per auth token and
 * dispatches multiplexed events by name. Used by http-sse and ws-sse modes.
 *
 * Current endpoint: /stream/?token=... (root multiplex). Will be replaced
 * by per-artifact streams once the API side lands — at that point this
 * file is the one thing to change; consumers via transport.on(event, …)
 * don't know or care about the underlying URL.
 */
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import type { EventChannel } from "./types";

type Handler = (data: Record<string, unknown>) => void;

class SseMultiplexer {
  private source: EventSource | null = null;
  private handlers = new Map<string, Set<Handler>>();

  connect(token: string | null) {
    if (this.source) return;

    // SSR guard — EventSource only exists in the browser.
    if (typeof window === "undefined" || typeof EventSource === "undefined")
      return;

    const url = new URL("/stream/", INTERNAL_HTTP_BASE);
    if (token) url.searchParams.set("token", token);

    this.source = new EventSource(url.toString());

    this.source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as {
          event: string;
          data: Record<string, unknown>;
        };
        const listeners = this.handlers.get(parsed.event);
        if (listeners) {
          for (const handler of listeners) {
            handler(parsed.data);
          }
        }
      } catch {
        // Malformed SSE data — skip.
      }
    };

    this.source.onerror = () => {
      // EventSource auto-reconnects — no action needed.
    };
  }

  disconnect() {
    this.source?.close();
    this.source = null;
  }

  on(event: string, handler: Handler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      const listeners = this.handlers.get(event);
      if (listeners) {
        listeners.delete(handler);
        if (listeners.size === 0) {
          this.handlers.delete(event);
        }
      }
    };
  }
}

const sseMultiplexer = new SseMultiplexer();

export function createSseEvents(authToken: string | null): EventChannel {
  sseMultiplexer.connect(authToken);
  return {
    on(event, handler) {
      return sseMultiplexer.on(event, handler);
    },
  };
}

/** Disconnect SSE — call on unmount/logout. */
export function disconnectSse() {
  sseMultiplexer.disconnect();
}
