/**
 * Global WebSocket Context for managing a single WebSocket connection
 * This provides a centralized way to manage WebSocket connections and events
 * across all components based on the user's profile ID
 */
"use client";

import { keys } from "@/lib/query/keys";
import { createSocketClient } from "@/lib/ws/socket";
import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Socket } from "socket.io-client";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

type Chat = {
  chat: {
    id: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    scenarioId: string;
    attemptId: string;
    completed: boolean;
    completedAt: string | null;
    traceId: string | null;
    documentIds: string[];
  };
  messages: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    chatId: string;
    content: string;
    type: "query" | "response";
    completed: boolean;
  }>;
};

export interface WebSocketContextType {
  // Connection state
  isConnected: boolean;
  socket: Socket | null;

  // Loading states for debugging
  startingSimulationId: string | null;
  isSendingSimulationMessage: boolean;
  isStoppingSimulation: boolean;
  isContinuingSimulation: boolean;
  isStartingAssistant: boolean;
  isSendingAssistantMessage: boolean;
  isStoppingAssistant: boolean;

  // Room management
  joinRoom: (roomId: string, roomType: "assistant" | "simulation") => void;
  leaveRoom: (roomId: string, roomType: "assistant" | "simulation") => void;
  // Simulation event emitters
  emitStartSimulation: (data: {
    simulation_id: string;
    profile_id?: string | null;
    scenario_id?: string | null;
    infinite?: boolean;
    infinite_time_limit?: number | null;
  }) => void;
  emitSendSimulationMessage: (data: {
    chat_id: string;
    message: string;
    isRetry?: boolean;
  }) => void;
  emitStopSimulation: (data: { chat_id: string }) => void;
  emitContinueSimulation: (data: {
    chat_id: string;
    attempt_id: string;
    end_all?: boolean;
    previous_chat_id?: string;
    previous_chat_map?: Record<string, string | null>;
    department_id?: string;
  }) => void;

  // Assistant event emitters
  emitStartAssistant: (data: {
    profile_id: string;
    initial_message: string;
    department_id: string;
  }) => void;
  emitSendAssistantMessage: (data: {
    chat_id: string;
    message: string;
  }) => void;
  emitStopAssistant: (data: { chat_id: string }) => void;
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
  profileId: string | null | undefined;
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

  /**
   * Stable guest id (per tab) used when profileId === null.
   * Using sessionStorage lets us survive re-renders & soft navigations.
   */
  const guestIdRef = useRef<string | null>(null);
  if (guestIdRef.current === null) {
    if (typeof window !== "undefined") {
      const existing = sessionStorage.getItem("guest-id");
      guestIdRef.current = existing ?? uuidv4();
      if (!existing) sessionStorage.setItem("guest-id", guestIdRef.current);
    } else {
      guestIdRef.current = uuidv4();
    }
  }

  // Loading states for debugging
  const [startingSimulationId, setStartingSimulationId] = useState<
    string | null
  >(null);
  const [isSendingSimulationMessage, setIsSendingSimulationMessage] =
    useState(false);
  const [isStoppingSimulation, setIsStoppingSimulation] = useState(false);
  const [isContinuingSimulation, setIsContinuingSimulation] = useState(false);
  const [isStartingAssistant, setIsStartingAssistant] = useState(false);
  const [isSendingAssistantMessage, setIsSendingAssistantMessage] =
    useState(false);
  const [isStoppingAssistant, setIsStoppingAssistant] = useState(false);
  // Set up section-specific event handlers
  const setupCommonEventHandlers = useCallback(
    (socket: Socket) => {
      // Assistant-specific message events
      socket.on(
        "assistant_new_message",
        (_data: {
          message_id: string;
          chat_id: string;
          role: string;
          content: string;
          completed: boolean;
          created_at: string;
        }) => {
          // Invalidate v2 assistant chat query (will refetch all data)
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: keys.assistant.all,
            });
          }, 0);
        }
      );

      // Simulation-specific message events
      socket.on(
        "simulation_new_message",
        (data: {
          message_id: string;
          chat_id: string;
          role: string;
          content: string;
          completed: boolean;
          created_at: string;
        }) => {
          // Dispatch simulationMessageStart event for response messages to trigger immediate UI display
          if (data.role === "assistant" || data.role === "response") {
            window.dispatchEvent(
              new CustomEvent("simulationMessageStart", {
                detail: {
                  messageId: data.message_id,
                  chatId: data.chat_id,
                },
              })
            );
          }

          // Dispatch messageSent event for tour progression when user sends a message
          if (data.role === "user") {
            window.dispatchEvent(
              new CustomEvent("messageSent", {
                detail: {
                  messageId: data.message_id,
                  chatId: data.chat_id,
                },
              })
            );
          }

          // Invalidate v2 attempts (includes messages)
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: keys.attempts.all,
            });
          }, 0);
        }
      );

      // Assistant message token updates
      socket.on(
        "assistant_message_token",
        (_data: {
          message_id: string;
          chat_id: string;
          accumulated_content: string;
        }) => {
          // Invalidate v2 assistant chat query (will refetch all data)
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: keys.assistant.all,
            });
          }, 0);
        }
      );

      // Simulation message token updates
      socket.on(
        "simulation_message_token",
        (data: {
          message_id: string;
          chat_id: string;
          token: string;
          accumulated_content: string;
        }) => {
          // Optimistically update the query cache with accumulated content
          // This updates ALL attempt queries to find the right message
          queryClient.setQueriesData(
            { queryKey: keys.attempts.all },
            (oldData: { chats: Chat[] } | undefined) => {
              if (!oldData?.chats) return oldData;

              return {
                ...oldData,
                chats: oldData.chats.map((chat: Chat) => {
                  if (chat.chat.id !== data.chat_id) return chat;

                  return {
                    ...chat,
                    messages: chat.messages.map((msg) =>
                      msg.id === data.message_id
                        ? { ...msg, content: data.accumulated_content }
                        : msg
                    ),
                  };
                }),
              };
            }
          );

          // Keep window event for potential future use
          window.dispatchEvent(
            new CustomEvent("simulationMessageToken", {
              detail: {
                messageId: data.message_id,
                chatId: data.chat_id,
                token: data.token,
                accumulatedContent: data.accumulated_content,
              },
            })
          );
        }
      );

      // Assistant message completion
      socket.on(
        "assistant_message_complete",
        (data: {
          message_id: string;
          chat_id: string;
          final_content: string;
          completed?: boolean;
        }) => {
          // Reset loading states
          setIsSendingAssistantMessage(false);

          // Dispatch custom event for assistant context
          window.dispatchEvent(
            new CustomEvent("assistant_message_complete", {
              detail: {
                messageId: data.message_id,
                chatId: data.chat_id,
                finalContent: data.final_content,
              },
            })
          );

          // Invalidate v2 assistant chat query (will refetch all data)
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: keys.assistant.all,
            });
          }, 0);
        }
      );

      // Assistant message cancellation
      socket.on(
        "assistant_message_cancelled",
        (data: {
          message_id: string;
          chat_id: string;
          final_content: string;
        }) => {
          // Reset loading states
          setIsSendingAssistantMessage(false);
          setIsStoppingAssistant(false);

          // Dispatch custom event for assistant context
          window.dispatchEvent(
            new CustomEvent("assistant_message_cancelled", {
              detail: {
                messageId: data.message_id,
                chatId: data.chat_id,
                finalContent: data.final_content,
              },
            })
          );

          // Invalidate v2 assistant chat query (will refetch all data)
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: keys.assistant.all,
            });
          }, 0);
        }
      );

      // Simulation message completion
      socket.on(
        "simulation_message_complete",
        (data: {
          message_id: string;
          chat_id: string;
          final_content: string;
          completed?: boolean;
          audio?: boolean;
        }) => {
          // Reset loading states
          setIsSendingSimulationMessage(false);

          // Dispatch window event for UI updates
          window.dispatchEvent(
            new CustomEvent("simulationMessageComplete", {
              detail: {
                messageId: data.message_id,
                chatId: data.chat_id,
                finalContent: data.final_content,
              },
            })
          );

          // Invalidate v2 attempts (includes messages)
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: keys.attempts.all,
            });
          }, 0);
        }
      );

      // Hint generation progress
      socket.on(
        "hint_generation_progress",
        (data: {
          type: string;
          message: string;
          chat_id: string;
          message_id: string;
          hint_ids?: string[];
          hints_count?: number;
          error?: string;
        }) => {
          // Dispatch DOM event for components to listen to
          window.dispatchEvent(
            new CustomEvent("hint_generation_progress", {
              detail: data,
            })
          );
        }
      );

      // Grading progress
      socket.on(
        "simulation_grading_progress",
        (data: {
          type: string;
          chat_id: string;
          standard_group_name?: string;
          standard_group_short_name?: string;
          score?: number;
          feedback_preview?: string;
          completed_count?: number;
          total_count?: number;
          message?: string;
          grade_id?: string;
          total_score?: number;
          passed?: boolean;
          standards_graded?: number;
          time_taken?: number;
          summary?: string;
        }) => {
          // Dispatch DOM event for SimulationContext to listen to
          window.dispatchEvent(
            new CustomEvent("simulationGradingProgress", {
              detail: data,
            })
          );
        }
      );

      // Simulation message cancellation
      socket.on(
        "simulation_message_cancelled",
        (data: {
          message_id: string;
          chat_id: string;
          final_content: string;
        }) => {
          // Reset loading states
          setIsSendingSimulationMessage(false);
          setIsStoppingSimulation(false);

          // Dispatch window event for UI updates
          window.dispatchEvent(
            new CustomEvent("simulationMessageCancelled", {
              detail: {
                messageId: data.message_id,
                chatId: data.chat_id,
                finalContent: data.final_content,
              },
            })
          );

          // Invalidate v2 attempts (includes messages)
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: keys.attempts.all,
            });
          }, 0);
        }
      );

      // Simulation message error
      socket.on(
        "simulation_message_error",
        (data: { chat_id: string; error: string }) => {
          // Reset loading states
          setIsSendingSimulationMessage(false);
          setIsStoppingSimulation(false);

          window.dispatchEvent(
            new CustomEvent("simulationMessageError", {
              detail: {
                chatId: data.chat_id,
                error: data.error,
              },
            })
          );

          toast.error(`Simulation error: ${data.error}`);
        }
      );

      socket.on(
        "message_cancelled",
        (_data: { message_id: string; chat_id: string }) => {
          // Invalidate v2 queries (for both assistant and simulation)
          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: keys.assistant.all,
            });
            queryClient.invalidateQueries({
              queryKey: keys.attempts.all,
            });
          }, 0);
        }
      );

      socket.on(
        "title_updated",
        (_data: { chat_id: string; title: string }) => {
          // Invalidate v2 assistant chat query (will refetch all data with updated title)
          queryClient.invalidateQueries({
            queryKey: keys.assistant.all,
          });
        }
      );

      socket.on(
        "joined_chat",
        (_data: { chat_type: string; chat_id: string }) => {}
      );

      // Tool call events
      socket.on(
        "tool_call_created",
        (_data: { tool_name: string; chat_id: string }) => {
          // Invalidate v2 assistant chat query (will refetch all data)
          queryClient.invalidateQueries({
            queryKey: keys.assistant.all,
          });
        }
      );

      socket.on(
        "tool_call_completed",
        (_data: { tool_name: string; chat_id: string }) => {
          // Invalidate v2 assistant chat query (will refetch all data)
          queryClient.invalidateQueries({
            queryKey: keys.assistant.all,
          });
        }
      );

      // Simulation-specific events
      socket.on(
        "simulation_started",
        (data: {
          success: boolean;
          message: string;
          attempt_id: string;
          chat_id: string;
        }) => {
          setStartingSimulationId(null);
          if (data.success) {
            toast.success(data.message);

            // Invalidate v2 attempts (includes chats, messages, grades, feedbacks)
            queryClient.invalidateQueries({
              queryKey: keys.attempts.all,
            });

            // Invalidate v2 layout context (includes simulations, cohorts, scenarios, etc.)
            queryClient.invalidateQueries({
              queryKey: keys.profile.all,
            });

            // Trigger navigation by emitting a custom event
            window.dispatchEvent(
              new CustomEvent("simulationStarted", {
                detail: { attemptId: data.attempt_id },
              })
            );

            // Invalidate home and practice queries to refresh data
            queryClient.invalidateQueries({
              queryKey: keys.home.all,
            });
            queryClient.invalidateQueries({
              queryKey: keys.practice.all,
            });
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "simulation_message_processing",
        (_data: { chat_id: string; status: string; message: string }) => {}
      );

      socket.on(
        "simulation_stopped",
        (data: { chat_id: string; success: boolean; message: string }) => {
          setIsStoppingSimulation(false);

          // Always let SimulationContext know about the stop event
          window.dispatchEvent(
            new CustomEvent("simulationStopped", {
              detail: {
                chatId: data.chat_id,
                success: data.success,
                message: data.message,
              },
            })
          );

          if (data.success) {
            // No toast for successful stops unless there's a message
            if (data.message) {
              toast.success(data.message);
            }
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "simulation_continued",
        (data: {
          success: boolean;
          message: string;
          completed_chat_id: string;
          next_chat_id: string;
          is_attempt_finished: boolean;
        }) => {
          setIsContinuingSimulation(false);

          if (data.success) {
            toast.success(data.message);

            // Invalidate v2 attempts (includes chats, messages, grades, feedbacks)
            queryClient.invalidateQueries({
              queryKey: keys.attempts.all,
            });

            // Dispatch a custom event with the new, richer detail object
            window.dispatchEvent(
              new CustomEvent("simulationChatEnded", {
                detail: {
                  completedChatId: data.completed_chat_id,
                  nextChatId: data.next_chat_id,
                  isAttemptFinished: data.is_attempt_finished,
                },
              })
            );

            // Dispatch chatEnded event for tour progression
            window.dispatchEvent(
              new CustomEvent("chatEnded", {
                detail: {
                  chatId: data.completed_chat_id,
                },
              })
            );

            // Invalidate home and practice queries to show updated grades/history
            queryClient.invalidateQueries({
              queryKey: keys.home.all,
            });
            queryClient.invalidateQueries({
              queryKey: keys.practice.all,
            });
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "end_all_completed",
        (data: { success: boolean; message: string; attempt_id: string }) => {
          setIsContinuingSimulation(false);

          if (data.success) {
            toast.success(data.message);

            // Invalidate v2 attempts (includes chats, messages, grades, feedbacks)
            queryClient.invalidateQueries({
              queryKey: keys.attempts.all,
            });

            // Dispatch a custom event for end all completion
            window.dispatchEvent(
              new CustomEvent("endAllCompleted", {
                detail: {
                  attemptId: data.attempt_id,
                },
              })
            );

            // Invalidate home and practice queries to show updated grades/history
            queryClient.invalidateQueries({
              queryKey: keys.home.all,
            });
            queryClient.invalidateQueries({
              queryKey: keys.practice.all,
            });
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "simulation_error",
        (data: { success: boolean; message: string }) => {
          setStartingSimulationId(null);
          setIsSendingSimulationMessage(false);
          setIsStoppingSimulation(false);
          setIsContinuingSimulation(false);
          toast.error(data.message);
          // Trigger error event for components that need to reset state
          window.dispatchEvent(new CustomEvent("simulationError"));
        }
      );

      // Assistant-specific events
      socket.on(
        "assistant_started",
        (data: { success: boolean; message: string; chat_id: string }) => {
          setIsStartingAssistant(false);
          if (data.success) {
            // toast.success(data.message);

            // Dispatch custom event for assistant context to handle chat_id
            window.dispatchEvent(
              new CustomEvent("assistant_started", {
                detail: { chat_id: data.chat_id },
              })
            );
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "assistant_message_processing",
        (_data: { chat_id: string; status: string; message: string }) => {}
      );

      socket.on(
        "assistant_stopped",
        (data: { chat_id: string; success: boolean; message: string }) => {
          setIsStoppingAssistant(false);
          if (data.success) {
            toast.success(data.message);
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "assistant_error",
        (data: { success: boolean; message: string }) => {
          setIsStartingAssistant(false);
          setIsSendingAssistantMessage(false);
          setIsStoppingAssistant(false);
          toast.error(data.message);

          // Dispatch custom event for assistant context
          window.dispatchEvent(
            new CustomEvent("assistant_error", {
              detail: {
                message: data.message,
              },
            })
          );
        }
      );
    },
    [queryClient]
  );

  // Initialize WebSocket connection when profileId is resolved (may be null for guest)
  useEffect(() => {
    // Distinguish undefined (still loading) vs null (guest) vs string (user)
    if (profileId === undefined) {
      return;
    }

    // Don't create multiple connections
    if (socketRef.current?.connected) {
      return;
    }

    // Capture current rooms at effect creation time for cleanup
    const roomsToCleanup = currentRoomsRef.current;

    const connectWebSocket = async () => {
      const query: Record<string, string | number | undefined> = {
        timestamp: Date.now(),
        EIO: "4",
      };
      if (profileId) {
        query["profileId"] = profileId;
      } else {
        // guest mode
        query["guestId"] = guestIdRef.current!;
      }

      const socket = createSocketClient(false, query);

      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        connectionAttempts.current = 0;
        const payload: {
          message: string;
          context: {
            component: string;
            function: string;
            profileId: string | null;
            transport: string;
            guestId?: string | null;
          };
          correlation?: { sessionId: string };
        } = {
          message: "Global WebSocket connected successfully",
          context: {
            component: "WebSocketContext",
            function: "onConnect",
            profileId,
            transport: socket.io.engine.transport.name,
            guestId: !profileId ? guestIdRef.current : null,
          },
        };
        if (socket.id)
          payload["correlation"] = { sessionId: socket.id as string };
      });

      // Handle connection confirmation from server
      socket.on(
        "connection_confirmed",
        (data: {
          sid: string;
          profile_id: string | null;
          guest_id?: string;
          server_time: number;
        }) => {
          const payload2: {
            message: string;
            context: {
              component: string;
              function: string;
              profileId: string | null;
              guestId?: string | null;
              serverTime: number;
              clientTime: number;
            };
            correlation?: { sessionId: string };
          } = {
            message: "Server confirmed WebSocket connection",
            context: {
              component: "WebSocketContext",
              function: "onConnectionConfirmed",
              profileId: data.profile_id,
              guestId: data.guest_id ?? null,
              serverTime: data.server_time,
              clientTime: Date.now(),
            },
          };
          if (data.sid)
            payload2["correlation"] = { sessionId: data.sid as string };
        }
      );

      socket.on("disconnect", (reason: string) => {
        setIsConnected(false);
        const payload3: {
          message: string;
          context: {
            component: string;
            function: string;
            profileId: string | null;
          };
          correlation?: { sessionId: string };
        } = {
          message: `Global WebSocket disconnected: ${reason}`,
          context: {
            component: "WebSocketContext",
            function: "onDisconnect",
            profileId,
          },
        };
        if (socket.id)
          payload3["correlation"] = { sessionId: socket.id as string };
      });

      socket.on("connect_error", (error: Error) => {
        connectionAttempts.current++;
        const payload4: {
          message: string;
          error: Error;
          context: {
            component: string;
            function: string;
            attempt: number;
            maxAttempts: number;
            profileId: string | null;
          };
          correlation?: { sessionId: string };
        } = {
          message: "Global WebSocket connection error",
          error,
          context: {
            component: "WebSocketContext",
            function: "onConnectError",
            attempt: connectionAttempts.current,
            maxAttempts: maxConnectionAttempts,
            profileId,
          },
        };
        if (socket.id)
          payload4["correlation"] = { sessionId: socket.id as string };
        setIsConnected(false);

        if (connectionAttempts.current >= maxConnectionAttempts) {
          toast.error(
            "Unable to connect to real-time updates. Some features may be limited."
          );
        }
      });

      socket.on("reconnect", (attemptNumber: number) => {
        setIsConnected(true);
        const payload5: {
          context: {
            component: string;
            function: string;
            profileId: string | null;
            attemptNumber: number;
          };
          correlation?: { sessionId: string };
        } = {
          context: {
            component: "WebSocketContext",
            function: "onReconnect",
            profileId,
            attemptNumber,
          },
        };
        if (socket.id)
          payload5["correlation"] = { sessionId: socket.id as string };
        toast.success("Connection restored!");
      });

      socket.on("reconnect_error", (error: Error) => {
        const payload6: {
          error: Error;
          context: {
            component: string;
            function: string;
            profileId: string | null;
          };
          correlation?: { sessionId: string };
        } = {
          error,
          context: {
            component: "WebSocketContext",
            function: "onReconnectError",
            profileId,
          },
        };
        if (socket.id)
          payload6["correlation"] = { sessionId: socket.id as string };
      });

      socket.on("reconnect_failed", () => {
        setIsConnected(false);
        const payload7: {
          message: string;
          context: {
            component: string;
            function: string;
            profileId: string | null;
          };
          correlation?: { sessionId: string };
        } = {
          message: "Global WebSocket reconnection failed permanently",
          context: {
            component: "WebSocketContext",
            function: "onReconnectFailed",
            profileId,
          },
        };
        if (socket.id)
          payload7["correlation"] = { sessionId: socket.id as string };
        toast.error("Connection lost. Please refresh the page to reconnect.");
      });

      // Set up common event handlers that update React Query cache
      setupCommonEventHandlers(socket);
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        const payload8: {
          message: string;
          context: {
            component: string;
            function: string;
            profileId: string | null;
          };
          correlation?: { sessionId: string };
        } = {
          message: "Cleaning up global WebSocket connection",
          context: {
            component: "WebSocketContext",
            function: "cleanup",
            profileId,
          },
        };
        if (socketRef.current?.id)
          payload8["correlation"] = {
            sessionId: socketRef.current.id as string,
          };
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
        return;
      }
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
        return;
      }
      socketRef.current.emit("leave_chat", {
        chat_id: roomId,
        chat_type: roomType,
      });
      currentRoomsRef.current.delete(roomId);

      // Note: We don't remove the persistent audio track here as it's shared across all rooms
    },
    []
  );

  // Event emitters
  const emitStartSimulation = useCallback(
    (data: {
      simulation_id: string;
      profile_id?: string | null;
      scenario_id?: string | null;
      infinite?: boolean;
      infinite_time_limit?: number | null;
    }) => {
      if (!socketRef.current || !isConnected) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }
      // Normalize nullish → ""
      const payload = {
        simulation_id: data.simulation_id,
        profile_id: data.profile_id ?? "",
        ...(data.scenario_id !== undefined && {
          scenario_id: data.scenario_id,
        }),
        ...(data.infinite !== undefined && { infinite: data.infinite }),
        ...(data.infinite_time_limit !== undefined && {
          infinite_time_limit: data.infinite_time_limit,
        }),
      };

      setStartingSimulationId(data.simulation_id);
      socketRef.current.emit("start_simulation", payload);
    },
    [isConnected]
  );

  const emitSendSimulationMessage = useCallback(
    (data: { chat_id: string; message: string; isRetry?: boolean }) => {
      if (!socketRef.current || !isConnected) {
        return;
      }

      setIsSendingSimulationMessage(true);
      socketRef.current.emit("send_simulation_message", data);
    },
    [isConnected]
  );

  const emitStopSimulation = useCallback(
    (data: { chat_id: string }) => {
      if (!socketRef.current || !isConnected) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsStoppingSimulation(true);
      socketRef.current.emit("stop_simulation", data);
    },
    [isConnected]
  );

  const emitContinueSimulation = useCallback(
    (data: {
      chat_id: string;
      attempt_id: string;
      end_all?: boolean;
      previous_chat_id?: string;
      previous_chat_map?: Record<string, string | null>;
      department_id?: string;
    }) => {
      if (!socketRef.current || !isConnected) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsContinuingSimulation(true);
      socketRef.current.emit("continue_simulation", data);
    },
    [isConnected]
  );

  // Assistant event emitters
  const emitStartAssistant = useCallback(
    (data: {
      profile_id: string;
      initial_message: string;
      department_id: string;
    }) => {
      if (!socketRef.current || !isConnected) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsStartingAssistant(true);
      socketRef.current.emit("start_assistant", data);
    },
    [isConnected]
  );

  const emitSendAssistantMessage = useCallback(
    (data: { chat_id: string; message: string }) => {
      if (!socketRef.current || !isConnected) {
        return;
      }

      setIsSendingAssistantMessage(true);
      socketRef.current.emit("send_assistant_message", data);
    },
    [isConnected]
  );

  const emitStopAssistant = useCallback(
    (data: { chat_id: string }) => {
      if (!socketRef.current || !isConnected) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsStoppingAssistant(true);
      socketRef.current.emit("stop_assistant", data);
    },
    [isConnected]
  );

  const value: WebSocketContextType = {
    isConnected,
    socket: socketRef.current,
    startingSimulationId,
    isSendingSimulationMessage,
    isStoppingSimulation,
    isContinuingSimulation,
    isStartingAssistant,
    isSendingAssistantMessage,
    isStoppingAssistant,
    joinRoom,
    leaveRoom,
    emitStartSimulation,
    emitSendSimulationMessage,
    emitStopSimulation,
    emitContinueSimulation,
    emitStartAssistant,
    emitSendAssistantMessage,
    emitStopAssistant,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
