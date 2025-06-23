/**
 * Chat Context for managing assistant chat functionality with WebSocket streaming
 * This provides a centralized way to manage chat UI states and real-time message handling
 */
"use client";
import { getWebSocketUrl } from "@/lib/utils";
import { AssistantChat, AssistantMessage, AssistantToolType } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { createAssistantChat } from "@/utils/mutations/assistant_chats/create-assistant-chat";
import { getAssistantChatsByProfile } from "@/utils/queries/assistant_chats/get-assistant-chats-by-profile";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
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

// Additional types for tool calls UI
export interface ToolCallData {
  id: string;
  name: string;
  type: AssistantToolType;
  arguments: Record<string, unknown>;
  status?: "pending" | "executing" | "completed" | "error";
}

export interface ToolCallResult {
  id: string;
  name: string;
  status: "success" | "error";
  result?: unknown;
  error?: string;
}

export interface AssistantMessageWithTools extends AssistantMessage {
  toolCalls?: ToolCallData[];
  toolResults?: ToolCallResult[];
}

type ChatUIState = "closed" | "widget" | "expanded";

interface ChatContextType {
  // UI State
  uiState: ChatUIState;
  openWidget: () => void;
  expand: () => void;
  close: () => void;

  // Chat Management
  currentChatId: string | null;
  pastChats: AssistantChat[] | undefined;
  isLoadingChats: boolean;

  // Chat Operations
  selectChat: (chatId: string | null) => void;
  startBlankChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  stopMessage: () => Promise<void>;

  // Loading States
  isCreatingChat: boolean;
  isSendingMessage: boolean;
  isStoppingMessage: boolean;

  // WebSocket Connection
  isConnected: boolean;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
};

interface ChatProviderProps {
  children: React.ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [uiState, setUiState] = useState<ChatUIState>("closed");
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isStoppingMessage, setIsStoppingMessage] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  const userId = useSession().data?.user?.id;

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

  // Fetch past chats for the current profile
  const { data: pastChats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["assistantChats", profile?.id],
    queryFn: () => getAssistantChatsByProfile(profile!.id),
    enabled: !!profile?.id,
  });

  // Initialize WebSocket connection
  useEffect(() => {
    if (!profile?.id) return;

    const socket = io(getWebSocketUrl(), {
      transports: ["websocket", "polling"],
      autoConnect: true,
      forceNew: true,
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      path: "/socket.io/",
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      logInfo("WebSocket connected");
    });

    socket.on("disconnect", (reason: string) => {
      setIsConnected(false);
      logInfo(`WebSocket disconnected: ${reason}`);
    });

    socket.on("connect_error", (error: Error) => {
      logError("WebSocket connection error:", error);
      setIsConnected(false);
    });

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
        logInfo(
          `Received new_message event: ${data.role} message for chat ${data.chat_id}`
        );

        // Update the messages cache with new message
        queryClient.setQueryData(
          ["assistantMessages", data.chat_id],
          (old: AssistantMessage[] = []) => {
            const exists = old.find((msg) => msg.id === data.message_id);
            if (exists) {
              return old;
            }

            const newMessage: AssistantMessage = {
              id: data.message_id,
              chatId: data.chat_id,
              role: data.role as "user" | "assistant",
              content: data.content,
              completed: data.completed,
              createdAt: data.created_at,
              updatedAt: data.created_at,
              completedAt: data.created_at,
            };

            const updated = [...old, newMessage].sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            );

            return updated;
          }
        );

        // Force re-render by invalidating the query after the update
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["assistantMessages", data.chat_id],
          });
        }, 0);
      }
    );

    socket.on("title_updated", (data: { chat_id: string; title: string }) => {
      logInfo(
        `Received title_updated event: ${data.title} for chat ${data.chat_id}`
      );
      // Update the chat title in the cache
      queryClient.setQueryData(
        ["assistantChat", data.chat_id],
        (old: AssistantChat | undefined) => {
          if (old) {
            return { ...old, title: data.title };
          }
          return old;
        }
      );

      // Also update the chats list
      queryClient.setQueryData(
        ["assistantChats", profile?.id],
        (old: AssistantChat[] = []) => {
          return old.map((chat) =>
            chat.id === data.chat_id ? { ...chat, title: data.title } : chat
          );
        }
      );
    });

    socket.on(
      "message_token",
      (data: {
        message_id: string;
        chat_id: string;
        token: string;
        accumulated_content: string;
      }) => {
        logInfo(
          `Received message_token: "${data.token}" for message ${data.message_id}`
        );

        // Update the specific message with streaming content
        queryClient.setQueryData(
          ["assistantMessages", data.chat_id],
          (old: AssistantMessage[] = []) => {
            const updated = old.map((msg) =>
              msg.id === data.message_id
                ? { ...msg, content: data.accumulated_content }
                : msg
            );

            return updated;
          }
        );

        // Force re-render by invalidating the query after the update
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["assistantMessages", data.chat_id],
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
      }) => {
        // Mark message as completed and update final content
        queryClient.setQueryData(
          ["assistantMessages", data.chat_id],
          (old: AssistantMessage[] = []) => {
            const updated = old.map((msg) =>
              msg.id === data.message_id
                ? { ...msg, content: data.final_content, completed: true }
                : msg
            );

            return updated;
          }
        );

        setIsSendingMessage(false);

        // Refresh chat list to update with new messages
        queryClient.invalidateQueries({ queryKey: ["assistantChats"] });

        // Force re-render by invalidating the query after the update
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["assistantMessages", data.chat_id],
          });
        }, 0);
      }
    );

    socket.on("message_error", (data: { chat_id: string; error: string }) => {
      toast.error(`Chat error: ${data.error}`);
      setIsSendingMessage(false);
    });

    socket.on(
      "chat_stopped",
      (data: { chat_id: string; chat_type: string; message: string }) => {
        if (data.chat_id === currentChatId) {
          setIsSendingMessage(false);
          setIsStoppingMessage(false);
          toast.success(data.message || "Chat stopped successfully");
        }
      }
    );

    socket.on(
      "message_cancelled",
      (data: {
        message_id: string;
        chat_id: string;
        final_content: string;
      }) => {
        // Update the cancelled message with its final content
        queryClient.setQueryData(
          ["assistantMessages", data.chat_id],
          (old: AssistantMessage[] = []) => {
            const updated = old.map((msg) =>
              msg.id === data.message_id
                ? { ...msg, content: data.final_content, completed: true }
                : msg
            );

            return updated;
          }
        );

        setIsSendingMessage(false);
        setIsStoppingMessage(false);

        // Force re-render by invalidating the query after the update
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["assistantMessages", data.chat_id],
          });
        }, 0);
      }
    );

    socket.on("joined_chat", (data: { chat_id: string; chat_type: string }) => {
      logInfo(`Successfully joined ${data.chat_type} chat: ${data.chat_id}`);
    });

    socket.on(
      "tool_call_start",
      (data: {
        tool_call_id: string;
        message_id: string;
        chat_id: string;
        tool_data: ToolCallData;
      }) => {
        // Update the messages cache with tool call start
        queryClient.setQueryData(
          ["assistantMessages", data.chat_id],
          (old: AssistantMessage[] = []) => {
            const updated = old.map((msg) => {
              if (msg.id === data.message_id) {
                const messageWithTools = msg as AssistantMessageWithTools;
                const toolCall: ToolCallData = {
                  ...data.tool_data,
                  status: "executing",
                };
                return {
                  ...messageWithTools,
                  toolCalls: [...(messageWithTools.toolCalls || []), toolCall],
                };
              }
              return msg;
            });

            return updated;
          }
        );

        // Force re-render by invalidating the query after the update
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["assistantMessages", data.chat_id],
          });
        }, 0);
      }
    );

    socket.on(
      "tool_call_result",
      (data: {
        message_id: string;
        chat_id: string;
        tool_result: ToolCallResult;
      }) => {
        // Update the messages cache with tool call result
        queryClient.setQueryData(
          ["assistantMessages", data.chat_id],
          (old: AssistantMessage[] = []) => {
            const updated = old.map((msg) => {
              if (msg.id === data.message_id) {
                const messageWithTools = msg as AssistantMessageWithTools;
                return {
                  ...messageWithTools,
                  toolCalls: messageWithTools.toolCalls?.map((tc) =>
                    tc.id === data.tool_result.id
                      ? {
                          ...tc,
                          status:
                            data.tool_result.status === "success"
                              ? "completed"
                              : "error",
                        }
                      : tc
                  ),
                  toolResults: [
                    ...(messageWithTools.toolResults || []),
                    data.tool_result,
                  ],
                };
              }
              return msg;
            });

            return updated;
          }
        );

        // Force re-render by invalidating the query after the update
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: ["assistantMessages", data.chat_id],
          });
        }, 0);
      }
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [profile?.id, queryClient, currentChatId]);

  // Join/leave chat rooms when currentChatId changes
  useEffect(() => {
    if (!socketRef.current || !isConnected) return;

    if (currentChatId) {
      socketRef.current.emit("join_chat", {
        chat_id: currentChatId,
        chat_type: "assistant",
      });
    }

    return () => {
      if (currentChatId && socketRef.current) {
        socketRef.current.emit("leave_chat", {
          chat_id: currentChatId,
          chat_type: "assistant",
        });
      }
    };
  }, [currentChatId, isConnected]);

  // UI State Management
  const openWidget = useCallback(() => {
    setUiState("widget");
  }, []);

  const expand = useCallback(() => {
    setUiState("expanded");
  }, []);

  const close = useCallback(() => {
    setUiState("closed");
  }, []);

  // Select existing chat or null for blank chat
  const selectChat = useCallback((chatId: string | null) => {
    setCurrentChatId(chatId);
  }, []);

  // Start a blank chat (sets currentChatId to null)
  const startBlankChat = useCallback(() => {
    setCurrentChatId(null);
  }, []);

  // Start new chat mutation
  const startChatMutation = useMutation({
    mutationFn: async (initialMessage: string) => {
      if (!profile?.id) {
        throw new Error("Profile ID is required");
      }

      // Create new chat before calling the API
      const chat = await createAssistantChat({
        title: "New Chat",
        profileId: profile.id,
      });

      if (!chat) {
        throw new Error("Failed to create chat");
      }

      // Set the current chat ID immediately so WebSocket connection is established
      setCurrentChatId(chat.id);

      const formData = new FormData();
      formData.append("initial_message", initialMessage);
      formData.append("chat_id", chat.id);

      // Wait for the API response to ensure proper error handling
      const response = await fetch(
        `${process.env["NEXT_PUBLIC_API_URL"]}/assistants/start`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return chat.id;
    },
    onSuccess: (_chatId) => {
      // Chat ID is already set above, just invalidate queries
      queryClient.invalidateQueries({ queryKey: ["assistantChats"] });
      queryClient.invalidateQueries({
        queryKey: ["assistantChats", profile?.id],
      });
    },
    onError: (error) => {
      toast.error(`Failed to start chat: ${error}`);
      setIsSendingMessage(false);
      // Reset chat ID on error
      setCurrentChatId(null);
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      chatId,
      content,
    }: {
      chatId: string;
      content: string;
    }) => {
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("message", content);

      const response = await fetch(
        `${process.env["NEXT_PUBLIC_API_URL"]}/assistants/message`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error}`);
      setIsSendingMessage(false);
    },
  });

  // Main send message function
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      setIsSendingMessage(true);

      if (!currentChatId) {
        // Start new chat with first message
        await startChatMutation.mutateAsync(content);
      } else {
        // Send message to existing chat
        await sendMessageMutation.mutateAsync({
          chatId: currentChatId,
          content,
        });
      }
    },
    [currentChatId, startChatMutation, sendMessageMutation]
  );

  // Stop message function
  const stopMessage = useCallback(async () => {
    if (!currentChatId || !socketRef.current || isStoppingMessage) return;

    setIsStoppingMessage(true);

    try {
      const formData = new FormData();
      formData.append("chat_id", currentChatId);

      const response = await fetch(
        `${process.env["NEXT_PUBLIC_API_URL"]}/assistants/stop`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // The WebSocket event will handle state updates
    } catch (error) {
      toast.error(`Failed to stop message: ${error}`);
      setIsStoppingMessage(false);
    }
  }, [currentChatId, isStoppingMessage]);

  const value: ChatContextType = {
    // UI State
    uiState,
    openWidget,
    expand,
    close,

    // Chat Management
    currentChatId,
    pastChats,
    isLoadingChats,

    // Chat Operations
    selectChat,
    startBlankChat,
    sendMessage,
    stopMessage,

    // Loading States
    isCreatingChat: startChatMutation.isPending,
    isSendingMessage,
    isStoppingMessage,

    // WebSocket Connection
    isConnected,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
