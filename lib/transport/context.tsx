/**
 * TransportProvider — composes a Transport from a command channel and an
 * event channel.
 *
 * The transport identity is **stable for the page lifetime**. When the
 * underlying connectivity changes (WS connects / disconnects), the
 * transport's *internal* channel pointers swap, and every existing
 * subscription is transparently re-bound to the new active channel.
 * React consumers never see a transport identity change, so their
 * `useEffect`s don't tear down + re-subscribe and events are not lost
 * across the swap.
 *
 * Channel selection (single-active mode):
 *   socket connected  → WS commands + WS events
 *   socket disconnected → HTTP commands + SSE events (BFF-proxied)
 *
 * The legacy `mode` prop is still accepted; if set, it pins the
 * transport and disables auto-switching. Mostly useful for tests.
 */
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSocket } from "@/contexts/socket-context";
import type {
  CommandChannel,
  EventChannel,
  EventHandler,
  EventScope,
  Transport,
  TransportMode,
} from "./types";
import { createWsCommands } from "./commands-ws";
import { createHttpCommands } from "./commands-http";
import { createWsEvents } from "./events-ws";
import { createSseEvents } from "./events-sse";

const TransportContext = createContext<Transport | null>(null);

export function useTransport(): Transport {
  const ctx = useContext(TransportContext);
  if (!ctx) {
    throw new Error("useTransport must be used within a TransportProvider");
  }
  return ctx;
}

interface TransportProviderProps {
  children: React.ReactNode;
  /** Pin a transport mode and disable auto-switching. Omit for the
   *  default behavior (auto-detect with seamless WS↔SSE swap). */
  mode?: TransportMode;
  /** Auth token for SSE transport (legacy — the SSE BFF route attaches
   *  Bearer auth server-side, so this is no longer required). */
  authToken?: string | null;
}

interface Subscription {
  event: string;
  handler: EventHandler;
  scope: EventScope | undefined;
  /** Teardown for the currently-bound channel. Replaced on every swap. */
  unsub: () => void;
}

export function TransportProvider({
  children,
  mode: modeProp,
  authToken,
}: TransportProviderProps) {
  const { socket, isConnected } = useSocket();

  // ── Channel adapters: lazily created, stable for the page lifetime ────
  // The SSE/HTTP channels are always available. The WS channels are
  // (re)built whenever the underlying socket reference appears.
  const sseEventsRef = useRef<EventChannel | null>(null);
  const httpCommandsRef = useRef<CommandChannel | null>(null);
  const wsEventsRef = useRef<EventChannel | null>(null);
  const wsCommandsRef = useRef<CommandChannel | null>(null);

  if (!sseEventsRef.current) {
    sseEventsRef.current = createSseEvents(authToken ?? null);
  }
  if (!httpCommandsRef.current) {
    httpCommandsRef.current = createHttpCommands();
  }

  // ── Subscription registry — every transport.on() lands here ──────────
  const subscriptionsRef = useRef<Map<symbol, Subscription>>(new Map());

  // ── Active-channel pointers (mutable; not React state) ───────────────
  const activeEventsRef = useRef<EventChannel>(sseEventsRef.current);
  const activeCommandsRef = useRef<CommandChannel>(httpCommandsRef.current);

  // Visible mode for any consumer that reads it. State so React renders
  // when the channel actually flips, but the `transport` object identity
  // stays stable regardless.
  const [visibleMode, setVisibleMode] = useState<TransportMode>(
    modeProp ?? "http-sse",
  );

  // ── Stable transport object ──────────────────────────────────────────
  const transportRef = useRef<Transport | null>(null);
  if (!transportRef.current) {
    const send: CommandChannel["send"] = (endpoint, body) =>
      activeCommandsRef.current.send(endpoint, body);

    const on: EventChannel["on"] = (event, handler, scope) => {
      const key = Symbol(event);
      const sub: Subscription = {
        event,
        handler,
        scope,
        unsub: activeEventsRef.current.on(event, handler, scope),
      };
      subscriptionsRef.current.set(key, sub);
      return () => {
        const live = subscriptionsRef.current.get(key);
        if (!live) return;
        live.unsub();
        subscriptionsRef.current.delete(key);
      };
    };

    transportRef.current = {
      get mode() {
        return visibleMode;
      },
      get commands() {
        return activeCommandsRef.current;
      },
      get events() {
        return activeEventsRef.current;
      },
      send,
      on,
    } as Transport;
  }

  // ── Channel swap effect ──────────────────────────────────────────────
  // Decides which channels should be active and re-binds every existing
  // subscription to the new channel. No React re-renders for consumers
  // (transport identity is stable); only the `mode` value updates so
  // anything reading `transport.mode` for display can react.
  useEffect(() => {
    // Honor a pinned mode override.
    const pinnedMode = modeProp;
    const wsAvailable = !!socket && isConnected;

    let nextEvents: EventChannel = sseEventsRef.current!;
    let nextCommands: CommandChannel = httpCommandsRef.current!;
    let nextMode: TransportMode = "http-sse";

    if (pinnedMode) {
      // Pinned mode — assemble exactly what was asked for, falling back
      // to HTTP/SSE only if WS is required but not yet up.
      const wantsWsEvents = pinnedMode === "ws" || pinnedMode === "http-ws";
      const wantsWsCommands = pinnedMode === "ws" || pinnedMode === "ws-sse";

      if (wantsWsEvents && wsAvailable) {
        if (!wsEventsRef.current && socket) {
          wsEventsRef.current = createWsEvents(socket);
        }
        if (wsEventsRef.current) nextEvents = wsEventsRef.current;
      }
      if (wantsWsCommands && wsAvailable) {
        if (!wsCommandsRef.current && socket) {
          wsCommandsRef.current = createWsCommands(socket);
        }
        if (wsCommandsRef.current) nextCommands = wsCommandsRef.current;
      }
      nextMode = pinnedMode;
    } else if (wsAvailable && socket) {
      // Auto-detect: prefer WS for both channels when available.
      if (!wsEventsRef.current) wsEventsRef.current = createWsEvents(socket);
      if (!wsCommandsRef.current)
        wsCommandsRef.current = createWsCommands(socket);
      nextEvents = wsEventsRef.current;
      nextCommands = wsCommandsRef.current;
      nextMode = "ws";
    }

    const eventsChanged = nextEvents !== activeEventsRef.current;
    const commandsChanged = nextCommands !== activeCommandsRef.current;
    if (!eventsChanged && !commandsChanged && nextMode === visibleMode) {
      return;
    }

    if (eventsChanged) {
      // Re-bind every live subscription on the new event channel
      // before tearing down the old one — minimizes the window in
      // which an emitted event has no listener.
      const subCount = subscriptionsRef.current.size;
      // eslint-disable-next-line no-console
      console.log(
        `[transport] event channel swap → ${nextMode}, re-binding ${subCount} subscriptions`,
      );
      for (const sub of subscriptionsRef.current.values()) {
        const oldUnsub = sub.unsub;
        sub.unsub = nextEvents.on(sub.event, sub.handler, sub.scope);
        oldUnsub();
      }
      activeEventsRef.current = nextEvents;
    }
    if (commandsChanged) {
      activeCommandsRef.current = nextCommands;
    }
    if (nextMode !== visibleMode) {
      setVisibleMode(nextMode);
    }
  }, [socket, isConnected, modeProp, visibleMode]);

  // ── On unmount: tear down all subscriptions ──────────────────────────
  useEffect(() => {
    return () => {
      for (const sub of subscriptionsRef.current.values()) {
        try {
          sub.unsub();
        } catch {
          // best-effort
        }
      }
      subscriptionsRef.current.clear();
    };
  }, []);

  return (
    <TransportContext.Provider value={transportRef.current}>
      {children}
    </TransportContext.Provider>
  );
}
