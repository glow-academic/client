"use client";

import { createSocketClient } from "@/lib/ws/socket";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/lib/ws/types";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextType {
  socket: AppSocket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function useSocket(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProviderClient");
  }
  return context;
}

interface SocketProviderClientProps {
  children: React.ReactNode;
  profileId: string | null;
}

export function SocketProviderClient({
  children,
  profileId,
}: SocketProviderClientProps) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<AppSocket | null>(null);
  const connectionAttempts = useRef(0);
  // socket.io itself caps reconnection at `reconnectionAttempts: 3` (see
  // `lib/ws/socket.ts`). The toast threshold MUST sit at/below that cap or
  // the user is never told the socket has permanently given up — keep it
  // strictly under so the warning fires while/just as reconnection ends.
  const maxConnectionAttempts = 3;

  useEffect(() => {
    // Clean up existing socket if profile changes
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }

    // Guards against the async-connect race: ``createSocketClient`` awaits a
    // dynamic ``import("socket.io-client")``, so the effect can be torn down
    // (unmount or profileId change) before the socket resolves. Without this
    // flag the cleanup below runs while ``socketRef.current`` is still null —
    // disconnecting nothing — and the resolved socket then lands in the ref
    // with live ``connect``/``disconnect`` listeners that are never removed
    // (a leaked WebSocket + setState-after-unmount). When cancelled, dispose
    // the freshly-created socket immediately instead of storing it.
    let cancelled = false;

    // The raw API bearer is no longer held in client state / props (it's
    // kept server-side out of the NextAuth session). Fetch it on demand
    // from the cookie-authenticated `/api/ws-ticket` BFF route — the token
    // stays out of broadly-readable app state and is only used for the
    // handshake. See `app/api/ws-ticket/route.ts`. Reusable so the
    // reconnect handler below can mint a FRESH ticket: the original ticket
    // is derived from a long-lived id_token that can expire mid-session;
    // socket.io would otherwise replay the stale (now-rejected) token on
    // every reconnect attempt and burn through its retry cap silently.
    const fetchTicket = async (): Promise<string | null> => {
      try {
        const res = await fetch(
          new URL("/api/ws-ticket", window.location.origin).toString(),
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = (await res.json()) as { token?: string };
          return data.token ?? null;
        }
      } catch {
        // No ticket → connect without auth; the server rejects and the
        // connect_error path below handles the retry/toast.
      }
      return null;
    };

    const connectWebSocket = async () => {
      const query: Record<string, string | number | undefined> = {
        timestamp: Date.now(),
        EIO: "4",
      };

      const ticket = await fetchTicket();

      if (cancelled) {
        return;
      }

      // Auth is handled via the auth object, not query params.
      // Server resolves profile_id + session_id from the JWT.
      const socket = await createSocketClient(query, {
        token: ticket ? `Bearer ${ticket}` : undefined,
      });

      if (cancelled) {
        socket.disconnect();
        return;
      }

      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        connectionAttempts.current = 0;
      });

      socket.on("disconnect", () => {
        setIsConnected(false);
      });

      socket.on("connect_error", (_error: Error) => {
        connectionAttempts.current++;
        setIsConnected(false);

        if (connectionAttempts.current >= maxConnectionAttempts) {
          toast.error(
            "Unable to connect to real-time updates. Some features may be limited."
          );
        }
      });

      // Before each reconnection attempt, mint a FRESH ws-ticket and feed
      // it into `socket.auth` so socket.io stops replaying the original
      // (possibly-expired) token. Without this the server keeps rejecting
      // the stale token, socket.io exhausts `reconnectionAttempts` and
      // gives up permanently — a silent, reload-only-recoverable death.
      // `reconnect_attempt` fires on the manager; socket.io reads
      // `socket.auth` when it (re)opens the connection, so updating it here
      // applies to the imminent attempt. Errors fall through to a cleared
      // token (server rejects → next attempt / `reconnect_failed` toast).
      socket.io.on("reconnect_attempt", () => {
        if (cancelled) return;
        void fetchTicket().then((fresh) => {
          if (cancelled) return;
          socket.auth = { token: fresh ? `Bearer ${fresh}` : undefined };
        });
      });

      // socket.io has exhausted `reconnectionAttempts` and will not retry
      // on its own. Surface it (the per-attempt `connect_error` counter may
      // not have reached the threshold if attempts errored before firing).
      socket.io.on("reconnect_failed", () => {
        if (cancelled) return;
        setIsConnected(false);
        toast.error(
          "Unable to connect to real-time updates. Some features may be limited."
        );
      });
    };

    connectWebSocket();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [profileId]);

  const value = useMemo<SocketContextType>(
    () => ({
      socket: socketRef.current,
      isConnected,
    }),
    [isConnected]
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}
