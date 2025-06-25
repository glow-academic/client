/**
 * Global WebSocket Context for managing a single WebSocket connection
 * This provides a centralized way to manage WebSocket connections and events
 * across all components based on the user's profile ID
 */
"use client";
import { AssistantChat, AssistantMessage, SimulationMessage } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

interface WebSocketContextType {
  // Connection state
  isConnected: boolean;
  socket: Socket | null;

  // Room management
  joinRoom: (
    roomId: string,
    roomType: "assistant" | "simulation" | "eval"
  ) => void;
  leaveRoom: (
    roomId: string,
    roomType: "assistant" | "simulation" | "eval"
  ) => void;

  // Event emitters for different types of operations
  emitStartSimulation: (data: {
    simulation_id: string;
    profile_id: string;
  }) => void;
  emitSendMessage: (data: { chat_id: string; message: string }) => void;
  emitStopSimulation: (data: { chat_id: string }) => void;
  emitContinueSimulation: (data: {
    chat_id: string;
    attempt_id: string;
  }) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
};

interface WebSocketProviderProps {
  children: React.ReactNode;
  profileId?: string | undefined;
}

export function WebSocketProvider({
  children,
  profileId,
}: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const connectionAttempts = useRef(0);
  const maxConnectionAttempts = 5;
  const currentRoomsRef = useRef<Set<string>>(new Set());

  // Set up common event handlers that all components might need
  const setupCommonEventHandlers = useCallback(
    (socket: Socket) => {
      // Assistant chat events
      socket.on(
        "new_message",
        (data: {
          message_id: string;
          chat_id: string;
          role: string;
          content: string;
          completed: boolean;
          created_at: string;
        }) => {
          logInfo("Received new_message event", {
            messageId: data.message_id,
            chatId: data.chat_id,
            role: data.role,
          });

          // Update appropriate cache based on message type
          if (data.role === "assistant" || data.role === "user") {
            // Assistant message
            queryClient.setQueryData(
              ["assistantMessages", data.chat_id],
              (old: AssistantMessage[] = []) => {
                const exists = old.find((msg) => msg.id === data.message_id);
                if (exists) return old;

                const newMessage = {
                  id: data.message_id,
                  chatId: data.chat_id,
                  role: data.role,
                  content: data.content,
                  completed: data.completed,
                  createdAt: data.created_at,
                  updatedAt: data.created_at,
                  completedAt: data.created_at,
                };

                return [...old, newMessage].sort(
                  (a, b) =>
                    new Date(a.createdAt).getTime() -
                    new Date(b.createdAt).getTime()
                );
              }
            );
          } else {
            // Simulation message
            queryClient.setQueryData(
              ["simulationMessages", data.chat_id],
              (old: SimulationMessage[] = []) => {
                const exists = old.find((msg) => msg.id === data.message_id);
                if (exists) return old;

                const newMessage = {
                  id: data.message_id,
                  chatId: data.chat_id,
                  type: data.role === "user" ? "query" : "response",
                  content: data.content,
                  completed: data.completed,
                  createdAt: data.created_at,
                  audio: false,
                  filePath: null,
                };

                return [...old, newMessage].sort(
                  (a, b) =>
                    new Date(a.createdAt).getTime() -
                    new Date(b.createdAt).getTime()
                );
              }
            );
          }

          // Invalidate queries to trigger re-renders
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", data.chat_id],
            });
          }, 0);
        }
      );

      socket.on(
        "message_token",
        (data: {
          message_id: string;
          chat_id: string;
          accumulated_content: string;
        }) => {
          logInfo("Received message_token event", {
            messageId: data.message_id,
            chatId: data.chat_id,
          });

          // Update both assistant and simulation message caches
          queryClient.setQueryData(
            ["assistantMessages", data.chat_id],
            (old: AssistantMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id
                  ? { ...msg, content: data.accumulated_content }
                  : msg
              );
            }
          );

          queryClient.setQueryData(
            ["simulationMessages", data.chat_id],
            (old: SimulationMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id
                  ? { ...msg, content: data.accumulated_content }
                  : msg
              );
            }
          );

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", data.chat_id],
            });
          }, 0);
        }
      );

      socket.on(
        "message_complete",
        (data: {
          message_id: string;
          chat_id: string;
          final_content: string;
          completed: boolean;
        }) => {
          logInfo("Received message_complete event", {
            messageId: data.message_id,
            chatId: data.chat_id,
          });

          // Update both caches
          queryClient.setQueryData(
            ["assistantMessages", data.chat_id],
            (old: AssistantMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id
                  ? { ...msg, content: data.final_content, completed: true }
                  : msg
              );
            }
          );

          queryClient.setQueryData(
            ["simulationMessages", data.chat_id],
            (old: SimulationMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id
                  ? { ...msg, content: data.final_content, completed: true }
                  : msg
              );
            }
          );

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", data.chat_id],
            });
          }, 0);
        }
      );

      socket.on(
        "message_cancelled",
        (data: { message_id: string; chat_id: string }) => {
          logInfo("Received message_cancelled event", {
            messageId: data.message_id,
            chatId: data.chat_id,
          });

          // Update both caches
          queryClient.setQueryData(
            ["assistantMessages", data.chat_id],
            (old: AssistantMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id ? { ...msg, completed: true } : msg
              );
            }
          );

          queryClient.setQueryData(
            ["simulationMessages", data.chat_id],
            (old: SimulationMessage[] = []) => {
              return old.map((msg) =>
                msg.id === data.message_id ? { ...msg, completed: true } : msg
              );
            }
          );

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", data.chat_id],
            });
          }, 0);
        }
      );

      socket.on("title_updated", (data: { chat_id: string; title: string }) => {
        logInfo("Received title_updated event", {
          chatId: data.chat_id,
          title: data.title,
        });

        queryClient.setQueryData(
          ["assistantChat", data.chat_id],
          (old: AssistantChat) => {
            if (old) {
              return { ...old, title: data.title };
            }
            return old;
          }
        );

        queryClient.setQueryData(
          ["assistantChats", profileId],
          (old: AssistantChat[] = []) => {
            return old.map((chat) =>
              chat.id === data.chat_id ? { ...chat, title: data.title } : chat
            );
          }
        );
      });

      socket.on(
        "joined_chat",
        (data: { chat_type: string; chat_id: string }) => {
          logInfo(
            `Successfully joined ${data.chat_type} chat: ${data.chat_id}`
          );
        }
      );

      // Tool call events
      socket.on(
        "tool_call_created",
        (data: { tool_name: string; chat_id: string }) => {
          logInfo(
            `Tool call created: ${data.tool_name} for chat ${data.chat_id}`
          );
          queryClient.invalidateQueries({
            queryKey: ["assistantToolCalls", data.chat_id],
          });
        }
      );

      socket.on(
        "tool_call_completed",
        (data: { tool_name: string; chat_id: string }) => {
          logInfo(
            `Tool call completed: ${data.tool_name} for chat ${data.chat_id}`
          );
          queryClient.invalidateQueries({
            queryKey: ["assistantToolCalls", data.chat_id],
          });
        }
      );
    },
    [queryClient, profileId]
  );

  // Initialize WebSocket connection when profileId is available
  useEffect(() => {
    if (!profileId) {
      logInfo("Waiting for profile ID before connecting WebSocket", {
        profileId,
      });
      return;
    }

    // Don't create multiple connections
    if (socketRef.current?.connected) {
      logInfo("WebSocket already connected, skipping initialization", {
        profileId,
      });
      return;
    }

    // Capture current rooms at effect creation time for cleanup
    const roomsToCleanup = currentRoomsRef.current;

    const connectWebSocket = () => {
      logInfo("Initializing global WebSocket connection", {
        profileId,
        attempt: connectionAttempts.current + 1,
      });

      // Use the Next.js proxy route for Socket.IO connections
      const socketUrl = window.location.origin;
      const socketPath = "/api/ws/socket.io";

      const socket = io(socketUrl, {
        path: socketPath,
        transports: ["polling", "websocket"],
        autoConnect: true,
        forceNew: false,
        timeout: 15000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        upgrade: true,
        rememberUpgrade: true,
        query: {
          profileId,
          timestamp: Date.now(),
          EIO: "4",
        },
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        connectionAttempts.current = 0;
        logInfo("Global WebSocket connected successfully", {
          socketId: socket.id,
          profileId,
          transport: socket.io.engine.transport.name,
        });
      });

      socket.on("disconnect", (reason: string) => {
        setIsConnected(false);
        logInfo(`Global WebSocket disconnected: ${reason}`, {
          socketId: socket.id,
          profileId,
        });
      });

      socket.on("connect_error", (error: Error) => {
        connectionAttempts.current++;
        logError("Global WebSocket connection error:", error.message, {
          attempt: connectionAttempts.current,
          maxAttempts: maxConnectionAttempts,
          profileId,
        });
        setIsConnected(false);

        if (connectionAttempts.current >= maxConnectionAttempts) {
          toast.error(
            "Unable to connect to real-time updates. Some features may be limited."
          );
        }
      });

      socket.on("reconnect", (attemptNumber: number) => {
        setIsConnected(true);
        logInfo("Global WebSocket reconnected", {
          socketId: socket.id,
          profileId,
          attemptNumber,
        });
        toast.success("Connection restored!");
      });

      socket.on("reconnect_error", (error: Error) => {
        logError("Global WebSocket reconnection failed:", error.message, {
          profileId,
        });
      });

      socket.on("reconnect_failed", () => {
        setIsConnected(false);
        logError("Global WebSocket reconnection failed permanently", {
          profileId,
        });
        toast.error("Connection lost. Please refresh the page to reconnect.");
      });

      // Set up common event handlers that update React Query cache
      setupCommonEventHandlers(socket);
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        logInfo("Cleaning up global WebSocket connection");
        // Leave all rooms before disconnecting using captured rooms
        roomsToCleanup.forEach((roomId) => {
          socketRef.current?.emit("leave_chat", {
            chat_id: roomId,
            chat_type: "any",
          });
        });
        roomsToCleanup.clear();

        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [profileId, setupCommonEventHandlers]);

  // Room management
  const joinRoom = useCallback(
    (roomId: string, roomType: "assistant" | "simulation") => {
      if (!socketRef.current || !isConnected) {
        logInfo("Cannot join room - WebSocket not connected", {
          roomId,
          roomType,
        });
        return;
      }

      logInfo(`Joining room: ${roomId} (${roomType})`);
      socketRef.current.emit("join_chat", {
        chat_id: roomId,
        chat_type: roomType,
      });
      currentRoomsRef.current.add(roomId);
    },
    [isConnected]
  );

  const leaveRoom = useCallback(
    (roomId: string, roomType: "assistant" | "simulation") => {
      if (!socketRef.current) {
        logInfo("Cannot leave room - WebSocket not available", {
          roomId,
          roomType,
        });
        return;
      }

      logInfo(`Leaving room: ${roomId} (${roomType})`);
      socketRef.current.emit("leave_chat", {
        chat_id: roomId,
        chat_type: roomType,
      });
      currentRoomsRef.current.delete(roomId);
    },
    []
  );

  // Event emitters
  const emitStartSimulation = useCallback(
    (data: { simulation_id: string; profile_id: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot start simulation - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      logInfo("Emitting start_simulation", data);
      socketRef.current.emit("start_simulation", data);
    },
    [isConnected]
  );

  const emitSendMessage = useCallback(
    (data: { chat_id: string; message: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot send message - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      logInfo("Emitting send_message", { chatId: data.chat_id });
      socketRef.current.emit("send_message", data);
    },
    [isConnected]
  );

  const emitStopSimulation = useCallback(
    (data: { chat_id: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot stop simulation - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      logInfo("Emitting stop_simulation", data);
      socketRef.current.emit("stop_simulation", data);
    },
    [isConnected]
  );

  const emitContinueSimulation = useCallback(
    (data: { chat_id: string; attempt_id: string }) => {
      if (!socketRef.current || !isConnected) {
        logError("Cannot continue simulation - WebSocket not connected");
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      logInfo("Emitting continue_simulation", data);
      socketRef.current.emit("continue_simulation", data);
    },
    [isConnected]
  );

  const value: WebSocketContextType = {
    isConnected,
    socket: socketRef.current,
    joinRoom,
    leaveRoom,
    emitStartSimulation,
    emitSendMessage,
    emitStopSimulation,
    emitContinueSimulation,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
