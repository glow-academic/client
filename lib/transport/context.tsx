/**
 * TransportProvider — composes a Transport from a command channel and an
 * event channel, picked by mode. Static/env-driven selection; no mid-session
 * hot-swap.
 *
 *   ws       — WS commands  + WS events
 *   http-ws  — HTTP commands + WS events
 *   http-sse — HTTP commands + SSE events
 *   ws-sse   — WS commands   + SSE events
 *
 * Auto-detect: defaults to "ws" when the socket is connected, otherwise
 * "http-sse". Override via the `mode` prop.
 */
"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useSocket } from "@/contexts/socket-context";
import type {
  CommandChannel,
  EventChannel,
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
  /** Override transport mode. If omitted, auto-detects based on socket availability. */
  mode?: TransportMode;
  /** Auth token for SSE transport (from session). */
  authToken?: string | null;
}

export function TransportProvider({
  children,
  mode: modeProp,
  authToken,
}: TransportProviderProps) {
  const { socket, isConnected } = useSocket();

  const transport = useMemo<Transport>(() => {
    const mode: TransportMode =
      modeProp ?? (socket && isConnected ? "ws" : "http-sse");

    // Pick a command channel. WS commands require a socket; fall back to HTTP
    // when the mode wants WS but the socket isn't ready yet.
    const wantsWsCommands = mode === "ws" || mode === "ws-sse";
    const commands: CommandChannel =
      wantsWsCommands && socket
        ? createWsCommands(socket)
        : createHttpCommands();

    // Pick an event channel. WS events require a socket; fall back to SSE.
    const wantsWsEvents = mode === "ws" || mode === "http-ws";
    const events: EventChannel =
      wantsWsEvents && socket
        ? createWsEvents(socket)
        : createSseEvents(authToken ?? null);

    return {
      mode,
      commands,
      events,
      send: commands.send,
      on: events.on,
    };
  }, [socket, isConnected, modeProp, authToken]);

  return (
    <TransportContext.Provider value={transport}>
      {children}
    </TransportContext.Provider>
  );
}
