/**
 * Chat Context for managing assistant chat functionality with WebSocket streaming
 * This provides a centralized way to manage chat UI states and real-time message handling
 */
"use client";
import { AssistantChat, AssistantMessage } from "@/types";
import { messageAssistant } from "@/utils/api/assistants/message-assistant";
import { startAssistant } from "@/utils/api/assistants/start-assistant";
import { stopAssistant } from "@/utils/api/assistants/stop-assistant";
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
  const currentRoomRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const connectionAttempts = useRef(0);
  const maxConnectionAttempts = 5;

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

  // Initialize WebSocket connection with better error handling
  useEffect(() => {
    if (!profile?.id) return;

    // Don't create multiple connections
    if (socketRef.current?.connected) {
      logInfo("WebSocket already connected, skipping initialization");
      return;
    }

    const connectWebSocket = () => {
      logInfo("Initializing WebSocket connection", {
        profileId: profile.id,
        attempt: connectionAttempts.current + 1,
      });

      const socket = io("/api/ws", {
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
          profileId: profile.id,
          timestamp: Date.now(),
        },
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        connectionAttempts.current = 0; // Reset on successful connection
        logInfo("WebSocket connected successfully", {
          socketId: socket.id,
          profileId: profile.id,
        });
      });

      socket.on("disconnect", (reason: string) => {
        setIsConnected(false);
        logInfo(`WebSocket disconnected: ${reason}`, {
          socketId: socket.id,
          profileId: profile.id,
        });
      });

      socket.on("connect_error", (error: Error) => {
        connectionAttempts.current++;
        logError("WebSocket connection error:", error.message, {
          attempt: connectionAttempts.current,
          maxAttempts: maxConnectionAttempts,
          profileId: profile.id,
        });
        setIsConnected(false);

        // If we've exceeded max attempts, show user-friendly error
        if (connectionAttempts.current >= maxConnectionAttempts) {
          toast.error(
            "Unable to connect to real-time updates. Some features may be limited."
          );
        }
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
            `Received new_message event: ${data.role} message for chat ${data.chat_id}`,
            {
              messageId: data.message_id,
              content:
                data.content.substring(0, 50) +
                (data.content.length > 50 ? "..." : ""),
              completed: data.completed,
            }
          );

          // Update the messages cache with new message
          queryClient.setQueryData(
            ["assistantMessages", data.chat_id],
            (old: AssistantMessage[] = []) => {
              logInfo(`Updating message cache for chat ${data.chat_id}`, {
                oldMessagesCount: old.length,
                newMessageId: data.message_id,
              });

              const exists = old.find((msg) => msg.id === data.message_id);
              if (exists) {
                logInfo(`Message ${data.message_id} already exists, skipping`);
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

              logInfo(`Updated message cache`, {
                newMessagesCount: updated.length,
                addedMessage: {
                  id: newMessage.id,
                  role: newMessage.role,
                  content: newMessage.content.substring(0, 50),
                },
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
          // Always handle chat stopped events since we're in the right room
          setIsSendingMessage(false);
          setIsStoppingMessage(false);
          toast.success(data.message || "Chat stopped successfully");
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

      socket.on(
        "joined_chat",
        (data: { chat_id: string; chat_type: string }) => {
          logInfo(
            `Successfully joined ${data.chat_type} chat: ${data.chat_id}`
          );
        }
      );

      // Tool call events - simply invalidate tool calls cache when they change
      socket.on(
        "tool_call_created",
        (data: {
          tool_call_id: string;
          chat_id: string;
          tool_name: string;
          tool_type: string;
        }) => {
          logInfo(
            `Tool call created: ${data.tool_name} for chat ${data.chat_id}`
          );

          // Invalidate tool calls cache to refetch
          queryClient.invalidateQueries({
            queryKey: ["assistantToolCalls", data.chat_id],
          });
        }
      );

      socket.on(
        "tool_call_completed",
        (data: {
          tool_call_id: string | null;
          chat_id: string;
          tool_name: string;
        }) => {
          logInfo(
            `Tool call completed: ${data.tool_name} for chat ${data.chat_id}`
          );

          // Invalidate tool calls cache to refetch
          queryClient.invalidateQueries({
            queryKey: ["assistantToolCalls", data.chat_id],
          });
        }
      );
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        logInfo("Cleaning up WebSocket connection");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [profile?.id, queryClient]);

  // Join/leave chat rooms when currentChatId changes - with connection check
  useEffect(() => {
    if (!socketRef.current || !isConnected) {
      logInfo("Skipping room join - WebSocket not connected", {
        hasSocket: !!socketRef.current,
        isConnected,
        currentChatId,
      });
      return;
    }

    // Leave current room if we're in one
    if (currentRoomRef.current && socketRef.current) {
      logInfo(`Leaving previous chat room: ${currentRoomRef.current}`);
      socketRef.current.emit("leave_chat", {
        chat_id: currentRoomRef.current,
        chat_type: "assistant",
      });
      currentRoomRef.current = null;
    }

    // Join new room if we have a chat ID
    if (currentChatId && socketRef.current) {
      logInfo(`Joining new chat room: ${currentChatId}`);
      socketRef.current.emit("join_chat", {
        chat_id: currentChatId,
        chat_type: "assistant",
      });
      currentRoomRef.current = currentChatId;
    }

    return () => {
      if (currentRoomRef.current && socketRef.current) {
        logInfo(`Cleanup: Leaving chat room: ${currentRoomRef.current}`);
        socketRef.current.emit("leave_chat", {
          chat_id: currentRoomRef.current,
          chat_type: "assistant",
        });
        currentRoomRef.current = null;
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

  // Start new chat mutation with better WebSocket handling
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

      // Set the current chat ID immediately
      setCurrentChatId(chat.id);

      // Wait for WebSocket connection and room join with timeout
      const waitForConnection = async (maxWait = 3000) => {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWait) {
          if (isConnected && currentRoomRef.current === chat.id) {
            logInfo("WebSocket room joined successfully", { chatId: chat.id });
            return true;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        logInfo("WebSocket room join timeout, proceeding anyway", {
          chatId: chat.id,
        });
        return false;
      };

      await waitForConnection();

      // Use the startAssistant API function
      const response = await startAssistant({
        initial_message: initialMessage,
        chat_id: chat.id,
      });

      if (!response.success) {
        throw new Error(response.message);
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
      const response = await messageAssistant({
        chat_id: chatId,
        message: content,
      });

      if (!response.success) {
        throw new Error(response.message);
      }

      return response;
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
      const response = await stopAssistant({
        chat_id: currentChatId,
      });

      if (!response.success) {
        throw new Error(response.message);
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
