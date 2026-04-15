/**
 * HTTP + SSE transport — commands via HTTP, events via Server-Sent Events.
 * Enterprise mode: no WebSocket dependency, works through restrictive proxies.
 */
import { api } from "@/lib/api/client";
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import type { Transport } from "./types";

/**
 * SSE multiplexer — maintains a single EventSource connection and dispatches
 * events to registered handlers by event name.
 */
class SseMultiplexer {
  private source: EventSource | null = null;
  private handlers = new Map<string, Set<(data: Record<string, unknown>) => void>>();
  private authToken: string | null = null;

  connect(token: string | null) {
    this.authToken = token;
    if (this.source) return;

    // SSE endpoint — server multiplexes all events for this profile
    const url = new URL("/stream/", INTERNAL_HTTP_BASE);
    if (token) url.searchParams.set("token", token);

    this.source = new EventSource(url.toString());

    this.source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { event: string; data: Record<string, unknown> };
        const listeners = this.handlers.get(parsed.event);
        if (listeners) {
          for (const handler of listeners) {
            handler(parsed.data);
          }
        }
      } catch {
        // Malformed SSE data — skip
      }
    };

    this.source.onerror = () => {
      // EventSource auto-reconnects — no action needed
    };
  }

  disconnect() {
    this.source?.close();
    this.source = null;
  }

  on(event: string, handler: (data: Record<string, unknown>) => void): () => void {
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

export function createHttpSseTransport(authToken: string | null): Transport {
  // Connect SSE on creation
  sseMultiplexer.connect(authToken);

  return {
    mode: "http-sse",

    async send(endpoint, body) {
      return api.post(endpoint as Parameters<typeof api.post>[0], { body }) as Promise<Record<string, unknown>>;
    },

    on(event, handler) {
      return sseMultiplexer.on(event, handler);
    },
  };
}

/** Disconnect SSE — call on unmount/logout. */
export function disconnectSse() {
  sseMultiplexer.disconnect();
}
