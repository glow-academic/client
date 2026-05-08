/**
 * SSE event channel — one EventSource per (artifact, group_id), opened lazily.
 *
 * Topology:
 *   Consumer calls `transport.on("persona.generate.completed", handler, { groupId })`
 *   or with a wildcard like `transport.on("persona.*.started", handler, {...})`.
 *   The first `.`-segment ("persona") is the artifact and decides which
 *   EventSource the handler attaches to. The channel lazily opens
 *   `GET /api/stream/{artifact}?group_id={groupId}` — a same-origin BFF
 *   route on the Next.js server — if no EventSource exists for that
 *   (artifact, groupId) key, then registers the handler. When the last
 *   handler unsubscribes, the EventSource closes.
 *
 * Wire format:
 *   The server (`infra/stream/sse.py`) writes every event as a default
 *   `message` SSE record (no `event:` line). The envelope's
 *   `event_type` field carries the canonical name. We therefore
 *   listen once on the default `message` channel per stream and
 *   dispatch in JS — this also lets us support wildcard patterns,
 *   which `EventSource.addEventListener` cannot do natively.
 *
 * Auth: handled entirely by the BFF route (`app/api/stream/[artifact]/route.ts`).
 * It reads the user's Auth.js session server-side and attaches the Bearer
 * token to the upstream request — the JWT never reaches the browser.
 */
import type { EventChannel, EventScope } from "./types";

type Handler = (data: Record<string, unknown>) => void;

interface ExactSubscription {
  handlers: Set<Handler>;
}

interface PatternSubscription {
  pattern: string;
  regex: RegExp;
  handler: Handler;
}

interface EventSourceEntry {
  source: EventSource;
  /** Event-type → handlers registered for that exact name. */
  exact: Map<string, ExactSubscription>;
  /** Wildcard subscriptions matched against `event_type` per message. */
  patterns: PatternSubscription[];
  /** Native onmessage handler attached to `source`. */
  onMessage: (ev: MessageEvent) => void;
}

function artifactFromEventName(event: string): string {
  // Canonical event names are `{artifact}.{operation}.{phase}`. Wildcards
  // are anchored at the artifact too, so the first segment is always
  // a literal artifact name (e.g. `persona.*.started`, not `*.foo`).
  return event.split(".")[0] ?? event;
}

function sourceKey(artifact: string, groupId: string | null | undefined): string {
  return `${artifact}::${groupId ?? ""}`;
}

function isWildcard(event: string): boolean {
  return event.includes("*");
}

function compilePattern(event: string): RegExp {
  // Each `*` matches any sequence of non-dot characters; literal dots
  // stay literal. This makes `persona.*.started` match
  // `persona.group.started` but not `persona.group.text.started`.
  const escaped = event
    .split(".")
    .map((segment) =>
      segment === "*" ? "[^.]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("\\.");
  return new RegExp(`^${escaped}$`);
}

class PerArtifactSseMultiplexer {
  private sources = new Map<string, EventSourceEntry>();

  /** No-op: auth is handled by the same-origin BFF route. */
  setAuth(_token: string | null) {
    // intentional no-op
  }

  on(event: string, handler: Handler, scope?: EventScope): () => void {
    const artifact = artifactFromEventName(event);
    const groupId = scope?.groupId ?? null;
    // Upstream stream impls require a ``group_id`` query param and 400
    // when it's absent. Subscribers that mount before their page has
    // resolved a groupId would otherwise open a stream the upstream
    // immediately rejects — skip and rely on the caller's effect to
    // re-run once groupId arrives.
    if (!groupId) {
      return () => {};
    }
    const key = sourceKey(artifact, groupId);
    const entry = this.ensureSource(key, artifact, groupId);
    if (!entry) {
      // SSR / no EventSource — return a no-op unsubscribe.
      return () => {};
    }

    if (isWildcard(event)) {
      const sub: PatternSubscription = {
        pattern: event,
        regex: compilePattern(event),
        handler,
      };
      entry.patterns.push(sub);
      return () => {
        const idx = entry.patterns.indexOf(sub);
        if (idx >= 0) entry.patterns.splice(idx, 1);
        this.maybeCloseSource(key, entry);
      };
    }

    let exact = entry.exact.get(event);
    if (!exact) {
      exact = { handlers: new Set() };
      entry.exact.set(event, exact);
    }
    exact.handlers.add(handler);

    return () => {
      const e = entry.exact.get(event);
      if (!e) return;
      e.handlers.delete(handler);
      if (e.handlers.size === 0) {
        entry.exact.delete(event);
      }
      this.maybeCloseSource(key, entry);
    };
  }

  disconnect() {
    for (const entry of this.sources.values()) {
      entry.source.removeEventListener("message", entry.onMessage);
      entry.source.close();
    }
    this.sources.clear();
  }

  private maybeCloseSource(key: string, entry: EventSourceEntry) {
    if (entry.exact.size === 0 && entry.patterns.length === 0) {
      entry.source.removeEventListener("message", entry.onMessage);
      entry.source.close();
      this.sources.delete(key);
    }
  }

  private ensureSource(
    key: string,
    artifact: string,
    groupId: string | null,
  ): EventSourceEntry | null {
    const existing = this.sources.get(key);
    if (existing) return existing;

    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return null;
    }

    // Same-origin BFF route. The Next.js server attaches the Bearer
    // token to the upstream request out-of-band; no token in the URL.
    const url = new URL(`/api/stream/${artifact}`, window.location.origin);
    if (groupId) url.searchParams.set("group_id", groupId);

    const source = new EventSource(url.toString());

    // Single message-channel listener routes every envelope by
    // `event_type`. Any wildcard subscriber whose regex matches also
    // fires.
    const entry: EventSourceEntry = {
      source,
      exact: new Map(),
      patterns: [],
      onMessage: () => {
        /* assigned below once `entry` is captured */
      },
    };
    entry.onMessage = (ev: MessageEvent) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(ev.data) as Record<string, unknown>;
      } catch {
        return;
      }
      const eventType = data.event_type;
      if (typeof eventType !== "string") return;

      const exact = entry.exact.get(eventType);
      if (exact) {
        for (const h of exact.handlers) h(data);
      }

      if (entry.patterns.length > 0) {
        for (const sub of entry.patterns) {
          if (sub.regex.test(eventType)) sub.handler(data);
        }
      }
    };
    source.addEventListener("message", entry.onMessage);

    this.sources.set(key, entry);
    return entry;
  }
}

const sseMultiplexer = new PerArtifactSseMultiplexer();

export function createSseEvents(authToken: string | null): EventChannel {
  sseMultiplexer.setAuth(authToken);
  return {
    on(event, handler, scope) {
      return sseMultiplexer.on(event, handler, scope);
    },
  };
}

/** Disconnect every open SSE connection — call on logout. */
export function disconnectSse() {
  sseMultiplexer.disconnect();
}
