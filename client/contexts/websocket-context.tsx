/**
 * Global WebSocket Context for managing a single WebSocket connection
 * This provides a centralized way to manage WebSocket connections and events
 * across all components based on the user's profile ID
 */
"use client";

import { getApiBase } from "@/lib/api-base";
import { AssistantChat, AssistantMessage, SimulationMessage } from "@/types";
import { log, type LogEntry } from "@/utils/logger";
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
import { v4 as uuidv4 } from "uuid";

export interface WebSocketContextType {
  // Connection state
  isConnected: boolean;
  socket: Socket | null;

  // Loading states for debugging
  isStartingSimulation: boolean;
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
  }) => void;

  // Assistant event emitters
  emitStartAssistant: (data: {
    chat_id: string;
    initial_message: string;
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
  const [isStartingSimulation, setIsStartingSimulation] = useState(false);
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
        (data: {
          message_id: string;
          chat_id: string;
          role: string;
          content: string;
          completed: boolean;
          created_at: string;
        }) => {
          log.debug("ws.assistant.new_message", {
            context: {
              messageId: data.message_id,
              chatId: data.chat_id,
              role: data.role,
            },
          });

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

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
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
          log.debug("ws.simulation.new_message", {
            context: {
              messageId: data.message_id,
              chatId: data.chat_id,
              role: data.role,
            },
          });

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

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", data.chat_id],
            });
          }, 0);
        }
      );

      // Assistant message token updates
      socket.on(
        "assistant_message_token",
        (data: {
          message_id: string;
          chat_id: string;
          accumulated_content: string;
        }) => {
          log.debug("ws.assistant.message_token", {
            context: { messageId: data.message_id, chatId: data.chat_id },
          });

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

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
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
          log.debug("ws.simulation.message_token", {
            context: { messageId: data.message_id, chatId: data.chat_id },
          });

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
          log.debug("ws.assistant.message_complete", {
            context: { messageId: data.message_id, chatId: data.chat_id },
          });

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

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
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
          log.debug("ws.assistant.message_cancelled", {
            context: { messageId: data.message_id, chatId: data.chat_id },
          });

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

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["assistantMessages", data.chat_id],
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
          log.debug("ws.simulation.message_complete", {
            context: { messageId: data.message_id, chatId: data.chat_id },
          });

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

          // Reset loading states
          setIsSendingSimulationMessage(false);

          window.dispatchEvent(
            new CustomEvent("simulationMessageComplete", {
              detail: {
                messageId: data.message_id,
                chatId: data.chat_id,
                finalContent: data.final_content,
              },
            })
          );

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", data.chat_id],
            });
          }, 0);
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
          log.debug("ws.simulation.message_cancelled", {
            context: { messageId: data.message_id, chatId: data.chat_id },
          });

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

          // Reset loading states
          setIsSendingSimulationMessage(false);
          setIsStoppingSimulation(false);

          window.dispatchEvent(
            new CustomEvent("simulationMessageCancelled", {
              detail: {
                messageId: data.message_id,
                chatId: data.chat_id,
                finalContent: data.final_content,
              },
            })
          );

          setTimeout(() => {
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages", data.chat_id],
            });
          }, 0);
        }
      );

      // Simulation message error
      socket.on(
        "simulation_message_error",
        (data: { chat_id: string; error: string }) => {
          log.error("ws.simulation.message_error", {
            message: data.error,
            context: { chatId: data.chat_id },
          });

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
        (data: { message_id: string; chat_id: string }) => {
          log.debug("ws.message_cancelled", {
            context: { messageId: data.message_id, chatId: data.chat_id },
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
        log.debug("ws.title_updated", {
          context: { chatId: data.chat_id, title: data.title },
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

        // Only update profile-scoped chat list if we actually have a profile
        if (profileId) {
          queryClient.setQueryData(
            ["assistantChats", profileId],
            (old: AssistantChat[] = []) => {
              return old.map((chat) =>
                chat.id === data.chat_id ? { ...chat, title: data.title } : chat
              );
            }
          );
        }
      });

      socket.on(
        "joined_chat",
        (data: { chat_type: string; chat_id: string }) => {
          log.info("ws.joined_chat", {
            message: `Successfully joined ${data.chat_type} chat: ${data.chat_id}`,
            context: { chatId: data.chat_id, chatType: data.chat_type },
          });
        }
      );

      // Tool call events
      socket.on(
        "tool_call_created",
        (data: { tool_name: string; chat_id: string }) => {
          log.debug("ws.tool_call.created", {
            context: { tool: data.tool_name, chatId: data.chat_id },
          });
          queryClient.invalidateQueries({
            queryKey: ["assistantToolCalls", data.chat_id],
          });
        }
      );

      socket.on(
        "tool_call_completed",
        (data: { tool_name: string; chat_id: string }) => {
          log.debug("ws.tool_call.completed", {
            context: { tool: data.tool_name, chatId: data.chat_id },
          });
          queryClient.invalidateQueries({
            queryKey: ["assistantToolCalls", data.chat_id],
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
          log.info("ws.simulation.started", {
            message: "Simulation started",
            context: data,
          });
          setIsStartingSimulation(false);
          if (data.success) {
            toast.success(data.message);

            // Invalidate queries to ensure fresh data when navigating back
            // Invalidate all simulation attempts queries (including profile-specific ones)
            queryClient.invalidateQueries({
              queryKey: ["simulationAttempts"],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulations"],
            });

            // Also invalidate related queries that depend on attempts
            queryClient.invalidateQueries({
              queryKey: ["simulationChats"],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationGrades"],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationFeedbacks"],
            });

            // Invalidate profiles query since simulation attempts depend on it
            queryClient.invalidateQueries({
              queryKey: ["profiles"],
            });

            // Invalidate analytics-related queries that might be affected
            queryClient.invalidateQueries({
              queryKey: ["cohorts"],
            });
            queryClient.invalidateQueries({
              queryKey: ["scenarios"],
            });
            queryClient.invalidateQueries({
              queryKey: ["parameters"],
            });
            queryClient.invalidateQueries({
              queryKey: ["parameterItems"],
            });
            queryClient.invalidateQueries({
              queryKey: ["personas"],
            });
            queryClient.invalidateQueries({
              queryKey: ["agents"],
            });
            queryClient.invalidateQueries({
              queryKey: ["rubrics"],
            });
            queryClient.invalidateQueries({
              queryKey: ["standardGroups"],
            });
            queryClient.invalidateQueries({
              queryKey: ["standards"],
            });

            // Trigger navigation by emitting a custom event
            window.dispatchEvent(
              new CustomEvent("simulationStarted", {
                detail: { attemptId: data.attempt_id },
              })
            );
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "simulation_message_processing",
        (data: { chat_id: string; status: string; message: string }) => {
          log.debug("ws.simulation.message_processing", { context: data });
        }
      );

      socket.on(
        "simulation_stopped",
        (data: { chat_id: string; success: boolean; message: string }) => {
          log.info("ws.simulation.stopped", { context: data });
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
          log.info("ws.simulation.continued", { context: data });
          setIsContinuingSimulation(false);

          if (data.success) {
            toast.success(data.message);

            // Invalidate analytics queries when simulation progresses
            queryClient.invalidateQueries({
              queryKey: ["simulationAttempts"],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationChats"],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationGrades"],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationFeedbacks"],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages"],
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
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "end_all_completed",
        (data: { success: boolean; message: string; attempt_id: string }) => {
          log.info("ws.simulation.end_all_completed", { context: data });
          setIsContinuingSimulation(false);

          if (data.success) {
            toast.success(data.message);

            // Invalidate analytics queries when simulation completes
            queryClient.invalidateQueries({
              queryKey: ["simulationAttempts"],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationChats"],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationGrades"],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationFeedbacks"],
            });
            queryClient.invalidateQueries({
              queryKey: ["simulationMessages"],
            });

            // Dispatch a custom event for end all completion
            window.dispatchEvent(
              new CustomEvent("endAllCompleted", {
                detail: {
                  attemptId: data.attempt_id,
                },
              })
            );
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "simulation_error",
        (data: { success: boolean; message: string }) => {
          log.error("ws.simulation.error", { message: data.message });
          setIsStartingSimulation(false);
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
          log.info("ws.assistant.started", { context: data });
          setIsStartingAssistant(false);
          if (data.success) {
            // toast.success(data.message);
          } else {
            toast.error(data.message);
          }
        }
      );

      socket.on(
        "assistant_message_processing",
        (data: { chat_id: string; status: string; message: string }) => {
          log.debug("ws.assistant.message_processing", { context: data });
        }
      );

      socket.on(
        "assistant_stopped",
        (data: { chat_id: string; success: boolean; message: string }) => {
          log.info("ws.assistant.stopped", { context: data });
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
          log.error("ws.assistant.error", { message: data.message });
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
    [queryClient, profileId]
  );

  // Initialize WebSocket connection when profileId is resolved (may be null for guest)
  useEffect(() => {
    // Distinguish undefined (still loading) vs null (guest) vs string (user)
    if (profileId === undefined) {
      log.debug("ws.connect.wait_profile", {
        message: "Waiting for profileId resolution before connecting WebSocket",
      });
      return;
    }

    // Don't create multiple connections
    if (socketRef.current?.connected) {
      log.debug("ws.connect.skip_already_connected", {
        context: { profileId },
      });
      return;
    }

    // Capture current rooms at effect creation time for cleanup
    const roomsToCleanup = currentRoomsRef.current;

    const connectWebSocket = async () => {
      log.info("websocket.connect.start", {
        message: "Initializing global WebSocket connection",
        context: {
          component: "WebSocketContext",
          function: "connectWebSocket",
          profileId,
          attempt: connectionAttempts.current + 1,
        },
      });

      const socketPath = `${process.env["NEXT_PUBLIC_APP_PREFIX"] || ""}/socket.io`;
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

      const socket = io(getApiBase(), {
        path: socketPath,
        autoConnect: true,
        timeout: 30000, // Increase timeout
        reconnection: true,
        reconnectionAttempts: 3, // Reduce attempts to avoid spam
        reconnectionDelay: 2000,
        reconnectionDelayMax: 8000, // Reduced from 10000
        transports: ["websocket"], // Skip long-polling altogether
        upgrade: false, // No long-polling probe
        rememberUpgrade: true, // Cache for future reloads
        query,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        connectionAttempts.current = 0;
        const payload: Omit<LogEntry, "event" | "level"> = {
          message: "Global WebSocket connected successfully",
          context: {
            component: "WebSocketContext",
            function: "onConnect",
            profileId,
            transport: socket.io.engine.transport.name,
            guestId: !profileId ? guestIdRef.current : undefined,
          },
        };
        if (socket.id) payload.correlation = { sessionId: socket.id };
        log.info("websocket.connected", payload);
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
          const payload2: Omit<LogEntry, "event" | "level"> = {
            message: "Server confirmed WebSocket connection",
            context: {
              component: "WebSocketContext",
              function: "onConnectionConfirmed",
              profileId: data.profile_id,
              guestId: data.guest_id,
              serverTime: data.server_time,
              clientTime: Date.now(),
            },
          };
          if (data.sid) payload2.correlation = { sessionId: data.sid };
          log.info("websocket.connection.confirmed", payload2);
        }
      );

      socket.on("disconnect", (reason: string) => {
        setIsConnected(false);
        const payload3: Omit<LogEntry, "event" | "level"> = {
          message: `Global WebSocket disconnected: ${reason}`,
          context: {
            component: "WebSocketContext",
            function: "onDisconnect",
            profileId,
          },
        };
        if (socket.id) payload3.correlation = { sessionId: socket.id };
        log.info("websocket.disconnected", payload3);
      });

      socket.on("connect_error", (error: Error) => {
        connectionAttempts.current++;
        const payload4: Omit<LogEntry, "event" | "level"> = {
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
        if (socket.id) payload4.correlation = { sessionId: socket.id };
        log.error("websocket.connect.error", payload4);
        setIsConnected(false);

        if (connectionAttempts.current >= maxConnectionAttempts) {
          toast.error(
            "Unable to connect to real-time updates. Some features may be limited."
          );
        }
      });

      socket.on("reconnect", (attemptNumber: number) => {
        setIsConnected(true);
        const payload5: Omit<LogEntry, "event" | "level"> = {
          message: "Global WebSocket reconnected",
          context: {
            component: "WebSocketContext",
            function: "onReconnect",
            profileId,
            attemptNumber,
          },
        };
        if (socket.id) payload5.correlation = { sessionId: socket.id };
        log.info("websocket.reconnected", payload5);
        toast.success("Connection restored!");
      });

      socket.on("reconnect_error", (error: Error) => {
        const payload6: Omit<LogEntry, "event" | "level"> = {
          message: "Global WebSocket reconnection failed",
          error,
          context: {
            component: "WebSocketContext",
            function: "onReconnectError",
            profileId,
          },
        };
        if (socket.id) payload6.correlation = { sessionId: socket.id };
        log.error("websocket.reconnect.error", payload6);
      });

      socket.on("reconnect_failed", () => {
        setIsConnected(false);
        const payload7: Omit<LogEntry, "event" | "level"> = {
          message: "Global WebSocket reconnection failed permanently",
          context: {
            component: "WebSocketContext",
            function: "onReconnectFailed",
            profileId,
          },
        };
        if (socket.id) payload7.correlation = { sessionId: socket.id };
        log.error("websocket.reconnect.failed", payload7);
        toast.error("Connection lost. Please refresh the page to reconnect.");
      });

      // Set up common event handlers that update React Query cache
      setupCommonEventHandlers(socket);
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        const payload8: Omit<LogEntry, "event" | "level"> = {
          message: "Cleaning up global WebSocket connection",
          context: { component: "WebSocketContext", function: "cleanup" },
        };
        if (socketRef.current?.id)
          payload8.correlation = { sessionId: socketRef.current.id };
        log.info("websocket.cleanup", payload8);
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
        log.debug("ws.room.join.skip_not_connected", {
          context: { roomId, roomType },
        });
        return;
      }

      log.debug("ws.room.join", { context: { roomId, roomType } });
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
        log.debug("ws.room.leave.skip_no_socket", {
          context: { roomId, roomType },
        });
        return;
      }

      log.debug("ws.room.leave", { context: { roomId, roomType } });
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
        log.error("ws.simulation.start.skip_not_connected", {
          context: { function: "emitStartSimulation" },
        });
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

      setIsStartingSimulation(true);
      log.debug("ws.emit.start_simulation", { context: payload });
      socketRef.current.emit("start_simulation", payload);
    },
    [isConnected]
  );

  const emitSendSimulationMessage = useCallback(
    (data: { chat_id: string; message: string; isRetry?: boolean }) => {
      if (!socketRef.current || !isConnected) {
        log.error("ws.simulation.send.skip_not_connected", {
          context: { function: "emitSendSimulationMessage" },
        });
        return;
      }

      setIsSendingSimulationMessage(true);
      log.debug("ws.emit.send_simulation_message", {
        context: { chatId: data.chat_id, isRetry: data.isRetry },
      });
      socketRef.current.emit("send_simulation_message", data);
    },
    [isConnected]
  );

  const emitStopSimulation = useCallback(
    (data: { chat_id: string }) => {
      if (!socketRef.current || !isConnected) {
        log.error("ws.simulation.stop.skip_not_connected", {
          context: { function: "emitStopSimulation" },
        });
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsStoppingSimulation(true);
      log.debug("ws.emit.stop_simulation", { context: data });
      socketRef.current.emit("stop_simulation", data);
    },
    [isConnected]
  );

  const emitContinueSimulation = useCallback(
    (data: { chat_id: string; attempt_id: string; end_all?: boolean }) => {
      if (!socketRef.current || !isConnected) {
        log.error("ws.simulation.continue.skip_not_connected", {
          context: { function: "emitContinueSimulation" },
        });
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsContinuingSimulation(true);
      log.debug("ws.emit.continue_simulation", { context: data });
      socketRef.current.emit("continue_simulation", data);
    },
    [isConnected]
  );

  // Assistant event emitters
  const emitStartAssistant = useCallback(
    (data: { chat_id: string; initial_message: string }) => {
      if (!socketRef.current || !isConnected) {
        log.error("ws.assistant.start.skip_not_connected", {
          context: { function: "emitStartAssistant" },
        });
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsStartingAssistant(true);
      log.debug("ws.emit.start_assistant", { context: data });
      socketRef.current.emit("start_assistant", data);
    },
    [isConnected]
  );

  const emitSendAssistantMessage = useCallback(
    (data: { chat_id: string; message: string }) => {
      if (!socketRef.current || !isConnected) {
        log.error("ws.assistant.send.skip_not_connected", {
          context: { function: "emitSendAssistantMessage" },
        });
        return;
      }

      setIsSendingAssistantMessage(true);
      log.debug("ws.emit.send_assistant_message", {
        context: { chatId: data.chat_id },
      });
      socketRef.current.emit("send_assistant_message", data);
    },
    [isConnected]
  );

  const emitStopAssistant = useCallback(
    (data: { chat_id: string }) => {
      if (!socketRef.current || !isConnected) {
        log.error("ws.assistant.stop.skip_not_connected", {
          context: { function: "emitStopAssistant" },
        });
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }

      setIsStoppingAssistant(true);
      log.debug("ws.emit.stop_assistant", { context: data });
      socketRef.current.emit("stop_assistant", data);
    },
    [isConnected]
  );

  const value: WebSocketContextType = {
    isConnected,
    socket: socketRef.current,
    isStartingSimulation,
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
