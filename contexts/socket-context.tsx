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
  idToken: string | null;
}

// Hardcoded for development — in production this would come from env
const API_KEY = "glw_dev_test_key_123";

export function SocketProviderClient({
  children,
  profileId,
  idToken,
}: SocketProviderClientProps) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<AppSocket | null>(null);
  const connectionAttempts = useRef(0);
  const maxConnectionAttempts = 5;

  useEffect(() => {
    // Clean up existing socket if profile changes
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }

    const connectWebSocket = async () => {
      const query: Record<string, string | number | undefined> = {
        timestamp: Date.now(),
        EIO: "4",
      };

      // Auth is handled via the auth object, not query params.
      // Server resolves profile_id + session_id from the JWT.
      const socket = await createSocketClient(query, {
        token: idToken ? `Bearer ${idToken}` : undefined,
        apiKey: API_KEY,
      });

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
    };

    connectWebSocket();

    return () => {
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
