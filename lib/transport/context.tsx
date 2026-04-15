/**
 * TransportProvider — provides the active Transport to the component tree.
 *
 * Mode selection:
 *   - "ws"       — full WebSocket (default when socket connected)
 *   - "http-ws"  — HTTP commands + WebSocket events
 *   - "http-sse" — HTTP commands + SSE events (enterprise fallback)
 *   - "ws-sse"   — WebSocket commands + SSE events
 *
 * Auto-detection: defaults to "ws" when socket is connected, falls back
 * to "http-sse" when socket is unavailable. Override via `mode` prop.
 */
"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useSocket } from "@/contexts/socket-context";
import type { Transport, TransportMode } from "./types";
import { createWsTransport } from "./ws-transport";
import { createHttpWsTransport } from "./http-ws-transport";
import { createHttpSseTransport } from "./http-sse-transport";

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
    // Resolve effective mode
    const mode = modeProp ?? (socket && isConnected ? "ws" : "http-sse");

    switch (mode) {
      case "ws":
        if (socket) return createWsTransport(socket);
        // Fall through to http-sse if socket unavailable
        return createHttpSseTransport(authToken ?? null);

      case "http-ws":
        if (socket) return createHttpWsTransport(socket);
        return createHttpSseTransport(authToken ?? null);

      case "http-sse":
        return createHttpSseTransport(authToken ?? null);

      case "ws-sse":
        if (socket) {
          // Hybrid: WS for commands, SSE for events
          const ws = createWsTransport(socket);
          const sse = createHttpSseTransport(authToken ?? null);
          return { mode: "ws-sse", send: ws.send, on: sse.on };
        }
        return createHttpSseTransport(authToken ?? null);

      default:
        return createHttpSseTransport(authToken ?? null);
    }
  }, [socket, isConnected, modeProp, authToken]);

  return (
    <TransportContext.Provider value={transport}>
      {children}
    </TransportContext.Provider>
  );
}
