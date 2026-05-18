/**
 * WebSocket event channel — thin wrapper over socket.on/off with
 * wildcard support layered on top via ``socket.onAny``.
 *
 * Socket.io's ``socket.on(name, h)`` only fires for events whose name
 * matches the string literally — there is no built-in wildcard
 * matching. To keep wire-format parity with the SSE channel (where
 * wildcards like ``persona.*.completed`` work via JS-side dispatch),
 * we install a single ``onAny`` listener and route incoming events
 * through it: exact subscriptions hit a name-keyed map, wildcards
 * hit a regex list.
 *
 * Used by ws and http-ws modes.
 */
import type { AppSocket } from "@/contexts/socket-context";
import type { EventChannel } from "./types";

type Handler = (data: Record<string, unknown>) => void;

interface PatternSubscription {
  pattern: string;
  regex: RegExp;
  handler: Handler;
}

function isWildcard(event: string): boolean {
  return event.includes("*");
}

function compilePattern(event: string): RegExp {
  // Each ``*`` matches one path segment (no dots). Literal dots stay
  // literal. ``persona.*.completed`` matches ``persona.group.completed``
  // but not ``persona.generate.text.complete``.
  const escaped = event
    .split(".")
    .map((segment) =>
      segment === "*" ? "[^.]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("\\.");
  return new RegExp(`^${escaped}$`);
}

export function createWsEvents(socket: AppSocket): EventChannel {
  // Cast to the minimal surface we need — the socket.io client exposes
  // ``onAny`` / ``offAny`` but the typed wrapper around ``AppSocket``
  // doesn't surface them, so we narrow here.
  const s = socket as unknown as {
    on: (event: string, handler: Handler) => void;
    off: (event: string, handler: Handler) => void;
    onAny: (handler: (event: string, data: Record<string, unknown>) => void) => void;
    offAny: (handler: (event: string, data: Record<string, unknown>) => void) => void;
  };

  // Per-socket dispatch state. One ``onAny`` listener feeds both the
  // exact and pattern routers, so wildcard subscribers see every event
  // socket.io receives — same model as the SSE multiplexer.
  const exact = new Map<string, Set<Handler>>();
  const patterns: PatternSubscription[] = [];

  const anyHandler = (event: string, data: Record<string, unknown>) => {
    // Socket.io passes the event name as a separate argument; the SSE
    // path delivers it as ``event_type`` inside the envelope. Consumers
    // (notably ``useArtifactGeneration``'s wildcard lifecycle handler)
    // read ``data.event_type`` to derive the operation. Inject it here
    // so the WS payload looks identical from the consumer's POV.
    const enriched: Record<string, unknown> =
      typeof data?.event_type === "string"
        ? data
        : { ...data, event_type: event };

    const exactHandlers = exact.get(event);
    if (exactHandlers) {
      for (const h of exactHandlers) h(enriched);
    }
    if (patterns.length > 0) {
      for (const sub of patterns) {
        if (sub.regex.test(event)) sub.handler(enriched);
      }
    }
  };
  s.onAny(anyHandler);

  return {
    // ``scope`` is ignored — WS uses one multiplexed socket; group
    // filtering happens server-side via the publish path's group_id.
    on(event, handler, _scope) {
      if (isWildcard(event)) {
        const sub: PatternSubscription = {
          pattern: event,
          regex: compilePattern(event),
          handler,
        };
        patterns.push(sub);
        return () => {
          const idx = patterns.indexOf(sub);
          if (idx >= 0) patterns.splice(idx, 1);
        };
      }

      let handlers = exact.get(event);
      if (!handlers) {
        handlers = new Set();
        exact.set(event, handlers);
      }
      handlers.add(handler);
      return () => {
        const set = exact.get(event);
        if (!set) return;
        set.delete(handler);
        if (set.size === 0) exact.delete(event);
      };
    },
  };
}
