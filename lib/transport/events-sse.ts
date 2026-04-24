/**
 * SSE event channel — one EventSource per artifact, opened lazily.
 *
 * Topology:
 *   Consumer calls `transport.on("persona.draft.progress", handler)`.
 *   The first `.`-segment ("persona") is the artifact.
 *   The channel lazily opens `GET /{artifact}/stream` if no EventSource
 *   exists for that artifact, then registers the handler for that event type.
 *   When the last handler for an artifact unsubscribes, its EventSource closes.
 *
 * Server-side the stream emits SSE named events:
 *   event: artifacts.persona.draft.progress
 *   data: {...json...}
 *
 * So we subscribe via `source.addEventListener(eventType, …)` rather than
 * `onmessage`.
 *
 * Auth: token appended as `?token=…` query string (temporary — matches the
 * current cross-origin EventSource limitation where headers can't be set).
 *
 * Used by `http-sse` and `ws-sse` transport modes.
 */
import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import type { EventChannel } from "./types";

type Handler = (data: Record<string, unknown>) => void;

interface EventSourceEntry {
  source: EventSource;
  /** eventType → { nativeListener, handlers } */
  listeners: Map<
    string,
    { native: (ev: MessageEvent) => void; handlers: Set<Handler> }
  >;
}

function artifactFromEventName(event: string): string {
  const dot = event.indexOf(".");
  return dot === -1 ? event : event.slice(0, dot);
}

class PerArtifactSseMultiplexer {
  private sources = new Map<string, EventSourceEntry>();
  private authToken: string | null = null;

  setAuth(token: string | null) {
    this.authToken = token;
  }

  on(event: string, handler: Handler): () => void {
    const artifact = artifactFromEventName(event);
    const entry = this.ensureSource(artifact);
    if (!entry) {
      // SSR / no EventSource — return a no-op unsubscribe.
      return () => {};
    }

    let listener = entry.listeners.get(event);
    if (!listener) {
      const handlers = new Set<Handler>();
      const native = (ev: MessageEvent) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(ev.data) as Record<string, unknown>;
        } catch {
          return;
        }
        for (const h of handlers) h(data);
      };
      entry.source.addEventListener(event, native);
      listener = { native, handlers };
      entry.listeners.set(event, listener);
    }
    listener.handlers.add(handler);

    return () => {
      const l = entry.listeners.get(event);
      if (!l) return;
      l.handlers.delete(handler);
      if (l.handlers.size === 0) {
        entry.source.removeEventListener(event, l.native);
        entry.listeners.delete(event);
      }
      if (entry.listeners.size === 0) {
        entry.source.close();
        this.sources.delete(artifact);
      }
    };
  }

  disconnect() {
    for (const entry of this.sources.values()) {
      entry.source.close();
    }
    this.sources.clear();
  }

  private ensureSource(artifact: string): EventSourceEntry | null {
    const existing = this.sources.get(artifact);
    if (existing) return existing;

    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return null;
    }

    const url = new URL(`/${artifact}/stream`, INTERNAL_HTTP_BASE);
    if (this.authToken) url.searchParams.set("token", this.authToken);

    const source = new EventSource(url.toString());
    // EventSource auto-reconnects; no onerror action needed.
    const entry: EventSourceEntry = { source, listeners: new Map() };
    this.sources.set(artifact, entry);
    return entry;
  }
}

const sseMultiplexer = new PerArtifactSseMultiplexer();

export function createSseEvents(authToken: string | null): EventChannel {
  sseMultiplexer.setAuth(authToken);
  return {
    on(event, handler) {
      return sseMultiplexer.on(event, handler);
    },
  };
}

/** Disconnect every open SSE connection — call on logout. */
export function disconnectSse() {
  sseMultiplexer.disconnect();
}
